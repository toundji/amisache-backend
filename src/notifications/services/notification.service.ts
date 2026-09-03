// ============================================================
// UNIFIED AUTH — notification.service.ts
// Persistance + dispatch des notifications, lecture fusionnée
// (ciblées + groupe), et purge batchée.
// ============================================================
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { Notification } from '../entities/notification.entity';
import { NotificationState } from '../entities/notification-state.entity';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MODULE_OPTIONS,
} from '../notification.types';
import type {
  NotificationChannel,
  NotificationModuleOptions,
  NotifyPayload,
} from '../notification.types';
import type {
  ListNotificationsQuery,
  NotificationView,
  PaginatedNotifications,
} from '../dto/notification.dto';

const PURGE_CRON_JOB_NAME = 'notifications-purge';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly retentionDays: number;
  private readonly purgeBatchSize: number;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationState)
    private readonly stateRepo: Repository<NotificationState>,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.retentionDays = options.retentionDays ?? 30;
    this.purgeBatchSize = options.purgeBatchSize ?? 500;
  }

  /**
   * L'expression cron est configurable via forRoot() — pas connue à
   * l'évaluation de la classe, donc pas de décorateur @Cron statique ici.
   * On enregistre le job dynamiquement via SchedulerRegistry.
   */
  onModuleInit(): void {
    const cronTime = this.options.purgeCron ?? '0 3 * * *';
    const job = new CronJob(cronTime, () => {
      this.purge().catch((err) =>
        this.logger.error(`[Cron] Purge failed: ${err}`),
      );
    });
    this.schedulerRegistry.addCronJob(PURGE_CRON_JOB_NAME, job);
    job.start();
  }

  // ── Création + dispatch ────────────────────────────────────

  /**
   * Persiste AVANT le push live. Ne dispatche vers les channels résolus
   * que si la ligne a réellement été créée (insert ignoré = doublon).
   */
  async notify(payload: NotifyPayload): Promise<void> {
    const created = await this.persist(payload);
    if (!created) return;

    const channels = this.resolveChannels(payload);
    await Promise.allSettled(
      channels.map((channel) =>
        channel
          .send(payload)
          .catch((err) =>
            this.logger.error(`Channel "${channel.key}" failed: ${err}`),
          ),
      ),
    );
  }

  private async persist(payload: NotifyPayload): Promise<boolean> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values({
        userId: payload.userId ?? undefined,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? undefined,
        dedupKey: payload.dedupKey,
        expiresAt: payload.expiresAt ?? undefined,
      })
      .orIgnore()
      .execute();

    const raw = result.raw as { affectedRows?: number } | undefined;
    return (raw?.affectedRows ?? 0) > 0;
  }

  private resolveChannels(payload: NotifyPayload): NotificationChannel[] {
    const keys = this.options.channelsByType?.[payload.type];
    const candidates = keys
      ? this.channels.filter((channel) => keys.includes(channel.key))
      : this.channels;
    return candidates.filter((channel) => channel.supports(payload));
  }

  // ── Lecture ──────────────────────────────────────────────

  /** Liste fusionnée (ciblées + groupe), non-expirées, non-dismiss, paginée. */
  async findForUser(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<PaginatedNotifications> {
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const limit =
      query.limit && query.limit > 0
        ? Math.min(Math.floor(query.limit), 100)
        : 20;
    const now = new Date();

    const base = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin(
        NotificationState,
        'ns',
        'ns.notification_id = n.id AND ns.user_id = :userId',
        { userId },
      )
      .where('(n.userId = :userId OR n.userId IS NULL)', { userId })
      .andWhere('(n.userId IS NOT NULL OR ns.dismissed_at IS NULL)')
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > :now)', { now });

    const total = await base.clone().getCount();

    const { entities, raw } = await base
      .clone()
      .addSelect('ns.read_at', 'state_read_at')
      .orderBy('n.createdAt', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities<{ state_read_at: Date | null }>();

    const data: NotificationView[] = entities.map((n, i) => {
      const isBroadcast = n.userId == null;
      const readAt: Date | null = isBroadcast
        ? (raw[i]?.state_read_at ?? null)
        : (n.readAt ?? null);
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data ?? null,
        isRead: !!readAt,
        readAt,
        createdAt: n.createdAt,
        expiresAt: n.expiresAt ?? null,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const now = new Date();

    const targeted = await this.notificationRepo.count({
      where: { userId, readAt: IsNull() },
    });

    const broadcastUnread = await this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin(
        NotificationState,
        'ns',
        'ns.notification_id = n.id AND ns.user_id = :userId',
        { userId },
      )
      .where('n.userId IS NULL')
      .andWhere('ns.read_at IS NULL')
      .andWhere('ns.dismissed_at IS NULL')
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > :now)', { now })
      .getCount();

    return targeted + broadcastUnread;
  }

  // ── Mutations ─────────────────────────────────────────────

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });
    if (!notification) return;

    if (notification.userId != null) {
      if (notification.userId !== userId) return; // pas le destinataire
      await this.notificationRepo.update(
        { id: notificationId },
        { readAt: new Date() },
      );
      return;
    }

    await this.stateRepo.upsert(
      { userId, notificationId, readAt: new Date(), seenAt: new Date() },
      ['userId', 'notificationId'],
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    const broadcasts = await this.notificationRepo.find({
      where: { userId: IsNull() },
      select: { id: true },
    });
    if (!broadcasts.length) return;

    const now = new Date();
    await Promise.all(
      broadcasts.map((n) =>
        this.stateRepo.upsert(
          { userId, notificationId: n.id, readAt: now, seenAt: now },
          ['userId', 'notificationId'],
        ),
      ),
    );
  }

  /** DELETE ciblée / dismiss (dismissedAt) pour une notification de groupe. */
  async removeOrDismiss(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });
    if (!notification) return;

    if (notification.userId != null) {
      if (notification.userId !== userId) return;
      await this.notificationRepo.delete({ id: notificationId });
      return;
    }

    await this.stateRepo.upsert(
      { userId, notificationId, dismissedAt: new Date() },
      ['userId', 'notificationId'],
    );
  }

  // ── Purge (cron) ──────────────────────────────────────────

  /**
   * Supprime par lots (DELETE ... LIMIT n en boucle) les notifications
   * expirées et les notifications lues au-delà de la rétention configurée.
   * NotificationState est nettoyé en cascade (onDelete: 'CASCADE').
   */
  async purge(): Promise<void> {
    const now = new Date();
    const retentionCutoff = new Date(
      now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
    );

    const expiredCount = await this.deleteInBatches(
      'expires_at IS NOT NULL AND expires_at < ?',
      now,
    );
    const retainedCount = await this.deleteInBatches(
      'read_at IS NOT NULL AND read_at < ?',
      retentionCutoff,
    );

    if (expiredCount || retainedCount) {
      this.logger.log(
        `[Cron] Purged ${expiredCount} expired + ${retainedCount} old-read notifications.`,
      );
    }
  }

  /**
   * DELETE ... LIMIT n en boucle jusqu'à épuisement — pas un DELETE massif
   * unique. La DeleteQueryBuilder de TypeORM ne supporte pas LIMIT côté
   * MySQL, d'où le passage par une requête paramétrée brute.
   */
  private async deleteInBatches(
    condition: string,
    threshold: Date,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const result = await this.notificationRepo.manager.query<{
        affectedRows: number;
      }>(`DELETE FROM notifications WHERE ${condition} LIMIT ?`, [
        threshold,
        this.purgeBatchSize,
      ]);
      const affected = result?.affectedRows ?? 0;
      total += affected;
      if (affected < this.purgeBatchSize) break;
    }
    return total;
  }
}
