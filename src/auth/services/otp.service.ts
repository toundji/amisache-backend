// ============================================================
// UNIFIED AUTH — otp.service.ts
// Génération, envoi et vérification des OTP.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { apiGenerateOtp } from '../../utils/api-util';
import { redisConf, redisKeys } from '../../utils/redis.config';
import { ApiError } from '../../utils/api-error';
import { MailService } from '../../mail/mail.service';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class OtpService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly mailService: MailService,
  ) {}

  // ── Envoi OTP ─────────────────────────────────────────────

  /** Envoie un OTP de confirmation email après inscription */
  async sendConfirmOtp(user: User): Promise<void> {
    const conf = redisConf.confirm;

    await this.assertNotLocked('confirm', user.id);
    await this.incrementAttempt('confirm', user.id);

    const otp = apiGenerateOtp();
    await this.redis.setex(
      redisKeys.otp('confirm', user.id),
      conf.otpTtl!,
      otp,
    );

    await this.mailService.sendUserConfirmation(user, otp).catch((err) => {
      throw new ApiError('Unable to send confirmation email.', err?.message);
    });
  }

  /** Envoie un OTP de reset password */
  async sendResetOtp(user: User): Promise<void> {
    const conf = redisConf.reset;

    await this.assertNotLocked('reset', user.id);
    await this.incrementAttempt('reset', user.id);

    const otp = apiGenerateOtp();
    await this.redis.setex(redisKeys.otp('reset', user.id), conf.otpTtl!, otp);

    await this.mailService.sendResetPasswordCode(user, otp).catch((err) => {
      throw new ApiError('Unable to send reset email.', err?.message);
    });
  }

  /** Envoie un OTP de reset PIN */
  async sendPinOtp(user: User): Promise<void> {
    const conf = redisConf.pin;

    await this.assertNotLocked('pin', user.id);
    await this.incrementAttempt('pin', user.id);

    const otp = apiGenerateOtp();
    // Pour le PIN on réutilise le TTL de confirm (10min)
    await this.redis.setex(
      redisKeys.otp('pin', user.id),
      redisConf.confirm.otpTtl!,
      otp,
    );

    await this.mailService.sendUserConfirmation(user, otp).catch((err) => {
      throw new ApiError('Unable to send PIN reset email.', err?.message);
    });
  }

  // ── Vérification OTP ──────────────────────────────────────

  /** Vérifie un OTP et nettoie les clés Redis si valide */
  async verifyOtp(
    operation: string,
    userId: string,
    otp: string,
  ): Promise<void> {
    await this.assertNotLocked(operation, userId);

    const storedOtp = await this.redis.get(redisKeys.otp(operation, userId));

    if (!storedOtp) {
      throw new ApiError('OTP expired. Please request a new one.');
    }

    if (storedOtp !== otp) {
      await this.incrementAttempt(operation, userId);
      throw new ApiError('Invalid OTP code.');
    }

    // OTP valide — nettoyer les clés
    await Promise.all([
      this.redis.del(redisKeys.otp(operation, userId)),
      this.redis.del(redisKeys.att(operation, userId)),
    ]);
  }

  // ── Rate limiting ─────────────────────────────────────────

  /** Remet à zéro le compteur d'échecs après un succès (ex: login réussi) */
  async resetAttempts(operation: string, userId: string): Promise<void> {
    await this.redis.del(redisKeys.att(operation, userId));
  }

  async assertNotLocked(operation: string, userId: string): Promise<void> {
    const isLocked = await this.redis.get(redisKeys.lock(operation, userId));
    if (isLocked) {
      const conf = redisConf[operation];
      throw new ApiError(
        `Too many attempts. Please try again in ${conf?.lockMinutes ?? 10} minutes.`,
      );
    }
  }

  async incrementAttempt(operation: string, userId: string): Promise<void> {
    const conf = redisConf[operation];
    const attemptKey = redisKeys.att(operation, userId);
    const lockKey = redisKeys.lock(operation, userId);

    const count = await this.redis.incr(attemptKey);
    if (count === 1) {
      await this.redis.expire(attemptKey, conf.otpTtl ?? conf.lockDuration);
    }

    if (count > conf.maxAttempts) {
      await Promise.all([
        this.redis.setex(lockKey, conf.lockDuration, 'locked'),
        this.redis.del(attemptKey),
      ]);
      throw new ApiError(
        `Too many failed attempts. Account locked for ${conf.lockMinutes} minutes.`,
      );
    }
  }
}
