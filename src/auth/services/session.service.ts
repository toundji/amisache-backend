// ============================================================
// UNIFIED AUTH — session.service.ts
// Gestion des sessions et équipements (comme Telegram).
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { UserSession } from '../entities/user-session.entity';
import { UserDevice } from '../entities/user-device.entity';
import { ParsedDevice, hashRefreshToken } from '../../utils/api-util';
import { REFRESH_TOKEN_TTL } from '../../utils/redis.config';

export interface CreateSessionDto {
  userId: string;
  refreshToken: string;
  device: ParsedDevice;
  ip?: string;
  fcmToken?: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(UserSession) private sessionRepo: Repository<UserSession>,
    @InjectRepository(UserDevice) private deviceRepo: Repository<UserDevice>,
  ) {}

  // ── Créer / mettre à jour une session ─────────────────────

  /**
   * Upsert de l'équipement + création de session.
   * Même équipement = même ligne UserDevice (pas de doublon).
   */
  async createSession(dto: CreateSessionDto): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000);

    // 1. Upsert UserDevice
    await this.deviceRepo.upsert(
      {
        userId: dto.userId,
        deviceFingerprint: dto.device.fingerprint,
        deviceName: dto.device.deviceName,
        deviceType: dto.device.deviceType,
        os: dto.device.os,
        browser: dto.device.browser ?? undefined,
        fcmToken: dto.fcmToken ?? undefined,
        lastActiveAt: now,
      },
      ['deviceFingerprint'],
    );

    // 2. Upsert UserSession (même équipement = même session)
    await this.sessionRepo.upsert(
      {
        userId: dto.userId,
        deviceFingerprint: dto.device.fingerprint,
        refreshTokenHash: hashRefreshToken(dto.refreshToken),
        expiresAt,
        lastActiveAt: now,
        ip: dto.ip,
      },
      ['deviceFingerprint', 'userId'],
    );
  }

  // ── Rotation du refresh token ─────────────────────────────

  /**
   * Appelé à chaque /auth/refresh.
   * Met à jour le hash + renouvelle le TTL (7 jours glissants).
   */
  async rotateSession(
    userId: string,
    deviceFingerprint: string,
    newRefreshToken: string,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000);

    await this.sessionRepo.update(
      { userId, deviceFingerprint },
      {
        refreshTokenHash: hashRefreshToken(newRefreshToken),
        expiresAt,
        lastActiveAt: now,
      },
    );

    await this.deviceRepo.update({ deviceFingerprint }, { lastActiveAt: now });
  }

  // ── Trouver une session par refresh token ─────────────────

  async findByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const hash = hashRefreshToken(refreshToken);
    return this.sessionRepo.findOne({
      where: { refreshTokenHash: hash },
      select: {
        id: true,
        userId: true,
        deviceFingerprint: true,
        expiresAt: true,
        refreshTokenHash: true,
      },
    });
  }

  // ── Logout ────────────────────────────────────────────────

  /** Logout depuis un équipement spécifique */
  async deleteSession(
    userId: string,
    deviceFingerprint: string,
  ): Promise<void> {
    await this.sessionRepo.delete({ userId, deviceFingerprint });
  }

  /** Logout depuis tous les équipements */
  async deleteAllSessions(userId: string): Promise<void> {
    await this.sessionRepo.delete({ userId });
  }

  /**
   * Révocation d'une session par son id.
   * Le userId est obligatoire pour éviter qu'un utilisateur
   * puisse révoquer la session d'un autre.
   */
  async deleteSessionById(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepo.delete({ id: sessionId, userId });
  }

  // ── Liste des sessions (comme Telegram) ───────────────────

  /**
   * Retourne la liste des équipements connectés pour un utilisateur.
   * Utilisé pour la page "Sessions actives".
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await this.sessionRepo
      .createQueryBuilder('s')
      .innerJoin('s.device', 'd')
      .select([
        's.id',
        's.ip',
        's.lastActiveAt',
        's.createdAt',
        'd.deviceName',
        'd.deviceType',
        'd.os',
        'd.browser',
      ])
      .where('s.userId = :userId', { userId })
      .andWhere('s.expiresAt > :now', { now: new Date() })
      .orderBy('s.lastActiveAt', 'DESC')
      .getMany();

    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.device?.deviceName ?? 'Unknown',
      deviceType: s.device?.deviceType,
      os: s.device?.os,
      browser: s.device?.browser,
      ip: s.ip,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));
  }

  // ── Mise à jour du FCM token ──────────────────────────────

  async updateFcmToken(
    deviceFingerprint: string,
    fcmToken: string,
  ): Promise<void> {
    await this.deviceRepo.update({ deviceFingerprint }, { fcmToken });
  }

  // ── Récupérer les FCM tokens d'un utilisateur ─────────────

  async getFcmTokens(userId: string): Promise<string[]> {
    const devices = await this.deviceRepo.find({
      where: { userId },
      select: ['fcmToken'] as any,
    });
    return devices.map((d) => d.fcmToken).filter((t): t is string => !!t);
  }

  // ── Cron : nettoyage des sessions expirées ────────────────

  /**
   * Chaque nuit à 2h — supprime les sessions expirées.
   * Les UserDevice restent (fcmToken préservé).
   */
  @Cron('0 2 * * *')
  async cleanExpiredSessions(): Promise<void> {
    const result = await this.sessionRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    this.logger.log(`[Cron] Cleaned ${result.affected ?? 0} expired sessions.`);
  }
}

// ── Types ─────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  deviceName: string;
  deviceType?: string;
  os?: string;
  browser?: string | null;
  ip?: string;
  lastActiveAt: Date;
  createdAt?: Date;
}
