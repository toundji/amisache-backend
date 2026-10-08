// ============================================================
// AMISACHE — assistant-notifier.service.ts
// Destinataires humains de l'assistant : escalade d'une conversation
// (clergé actif d'une paroisse, ou admins Amisache) et alerte
// « assistant IA indisponible » (admins, au plus une toutes les 15 min).
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { ClergyMember } from '../../church/entities/clergy-member.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../shared/common.enum';
import { NotificationService } from '../../notifications/services/notification.service';
import { ChatRealtimeService } from '../../chat/services/chat-realtime.service';
import { ALERT_THROTTLE_SECONDS } from '../assistant.constants';

const ALERT_REDIS_KEY = 'assistant:llm-down-alert';

@Injectable()
export class AssistantNotifierService {
  private readonly logger = new Logger(AssistantNotifierService.name);

  constructor(
    @InjectRepository(ClergyMember)
    private readonly clergyRepo: Repository<ClergyMember>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly realtime: ChatRealtimeService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Membres du clergé actifs aujourd'hui (même critère que ClergyMemberService.findActiveForUserAndChurch). */
  async activeClergy(churchId: string): Promise<ClergyMember[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.clergyRepo.find({
      where: [
        { churchId, endDate: IsNull(), startDate: LessThanOrEqual(today) },
        { churchId, endDate: MoreThanOrEqual(today), startDate: LessThanOrEqual(today) },
      ],
      relations: { user: true },
    });
  }

  async adminUserIds(): Promise<string[]> {
    const admins = await this.userRepo
      .createQueryBuilder('u')
      .select('u.id')
      // FIND_IN_SET : `roles` est une colonne MySQL SET (cf. UserService.list)
      .where('FIND_IN_SET(:role, u.roles) > 0', { role: UserRole.admin })
      .getMany();
    return admins.map((u) => u.id);
  }

  async notifyEscalation(params: {
    userIds: string[];
    conversationId: string;
    reason: string;
    churchId: string | null;
    churchName?: string;
    escalatedAt: Date;
  }): Promise<void> {
    const title = params.churchName
      ? `Question transmise — ${params.churchName}`
      : 'Question transmise à l’équipe Amisache';

    await Promise.allSettled(
      params.userIds.map((userId) =>
        this.notificationService.notify({
          userId,
          type: 'chat.escalation',
          title,
          body: params.reason,
          data: { conversationId: params.conversationId, churchId: params.churchId },
          dedupKey: `chat-escalation:${params.conversationId}:${params.escalatedAt.getTime()}:${userId}`,
        }),
      ),
    );
  }

  /** Best-effort : ne lève jamais (appelée depuis le chemin de repli). */
  async alertLlmUnavailable(error: unknown): Promise<void> {
    try {
      const acquired = await this.redis.set(
        ALERT_REDIS_KEY,
        '1',
        'EX',
        ALERT_THROTTLE_SECONDS,
        'NX',
      );
      if (acquired !== 'OK') return;

      const message = error instanceof Error ? error.message : String(error);
      const at = new Date();
      const payload = {
        type: 'assistant.llm-unavailable',
        message: `Assistant IA indisponible — réponses de secours (FAQ) en cours. ${message}`,
        at,
      };

      this.realtime.emitToAdmins('assistant:alert', payload);

      const userIds = await this.adminUserIds();
      await Promise.allSettled(
        userIds.map((userId) =>
          this.notificationService.notify({
            userId,
            type: 'assistant.llm-unavailable',
            title: 'Assistant IA indisponible',
            body: payload.message,
            data: { error: message },
            dedupKey: `assistant-llm-down:${at.getTime()}:${userId}`,
          }),
        ),
      );
    } catch (alertError) {
      this.logger.error('Alerte « assistant IA indisponible » non envoyée', alertError as Error);
    }
  }
}
