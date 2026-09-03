// ============================================================
// UNIFIED AUTH — password.service.ts
// Reset, mise à jour et PIN.
//
// PIN — choix Argon2id vs AES :
//   Le PIN est court (4-6 chiffres = 10K à 1M combinaisons).
//   AES est réversible → si CRYPTO_KEY fuite = tous les PINs lisibles.
//   Argon2id est irréversible + coûteux (64MB/tentative)
//   → bruteforce de la DB devient économiquement impossible.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { addHours } from 'date-fns';
import * as argon2 from 'argon2';

import { User } from '../../users/entities/user.entity';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { MailService } from '../../mail/mail.service';
import {
  apiComparePasswords,
  apiHashPassword,
  apiJsonCrypt,
  apiJsonDecrypt,
} from '../../utils/api-util';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';

// ── Config Argon2id ───────────────────────────────────────────
// memoryCost 64MB + timeCost 3 = ~300ms/tentative sur serveur moyen
// Rend le bruteforce de 10K PINs = ~50 minutes par thread
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB
  timeCost: 3,
  parallelism: 4,
};

@Injectable()
export class PasswordService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Reset via OTP (mobile + web) ──────────────────────────

  async sendResetOtp(email: string): Promise<{ success: boolean }> {
    const user = await this.findByEmail(email);
    await this.otpService.sendResetOtp(user);
    return { success: true };
  }

  /**
   * Vérifie l'OTP et retourne un token temporaire signé (TTL 10min).
   * Ce token autorise uniquement la route /auth/reset-password.
   */
  async confirmResetOtp(
    email: string,
    otp: string,
  ): Promise<{ tempToken: string }> {
    const user = await this.findByEmail(email);
    await this.otpService.verifyOtp('reset', user.id, otp);

    const tempToken = this.jwtService.sign(
      { sub: user.id, purpose: 'reset_password' },
      { secret: process.env.JWT_SECRET, expiresIn: '10m' },
    );

    return { tempToken };
  }

  // ── Reset via lien email (web uniquement) ─────────────────

  async sendResetLink(email: string): Promise<{ success: boolean }> {
    const user = await this.findByEmail(email);

    const expired = addHours(new Date(), 2);
    const tokenData = { userId: user.id, expired: expired.toISOString() };
    const token = `rpt_${apiJsonCrypt(tokenData)}`;
    const url = `${process.env.RESET_PASSWORD_ADDRESS}?${process.env.RESET_PASSWORD_TOKEN}=${token}`;

    await this.mailService.sendResetPasswordLink(user, url).catch((err) => {
      throw new ApiError('Unable to send reset email.', err?.message);
    });

    return { success: true };
  }

  async resetPasswordFromLink(
    encryptedToken: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const raw = encryptedToken.startsWith('rpt_')
      ? encryptedToken.slice(4)
      : encryptedToken;

    const data = apiJsonDecrypt<{ userId: string; expired: string }>(raw);

    if (new Date(data.expired) < new Date()) {
      throw new ApiError('Reset link expired. Please request a new one.');
    }

    return this.applyPasswordReset(data.userId, newPassword);
  }

  // ── Appliquer le reset via tempToken (flow OTP) ───────────

  /**
   * Vérifie le tempToken JWT signé par confirmResetOtp (TTL 10min),
   * extrait l'userId depuis le payload, puis applique le nouveau mot de passe.
   *
   * Le tempToken contient : { sub: userId, purpose: 'reset_password' }
   * Il est signé avec JWT_SECRET et expire après 10 minutes.
   * Un token d'un autre purpose (ex: access) est explicitement rejeté.
   */
  async resetPassword(
    tempToken: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new ApiError(
        'Invalid or expired reset token. Please request a new OTP.',
        {
          code: HttpStatus.UNAUTHORIZED,
        },
      );
    }

    if (payload?.purpose !== 'reset_password') {
      throw new ApiError('Invalid token purpose.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    const userId = payload.sub as string;
    if (!userId) {
      throw new ApiError('Invalid reset token payload.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    return this.applyPasswordReset(userId, newPassword);
  }

  private async applyPasswordReset(
    userId: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ApiErrorNotFoundById('users', userId);

    await this.userRepo.update(userId, {
      password: apiHashPassword(newPassword),
    });

    // Invalider toutes les sessions existantes
    await this.sessionService.deleteAllSessions(userId);

    return { success: true };
  }

  // ── Mise à jour mot de passe ──────────────────────────────

  async updatePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) throw new ApiErrorNotFoundById('users', userId);

    if (!apiComparePasswords(oldPassword, user.password ?? '')) {
      throw new ApiError('Invalid current password.');
    }

    await this.userRepo.update(userId, {
      password: apiHashPassword(newPassword),
    });

    return { success: true };
  }

  // ── PIN (mobile uniquement) ───────────────────────────────

  /**
   * Définit ou met à jour le PIN.
   *
   * Stockage Argon2id (irréversible) :
   *   - Même si la DB est compromise → PIN illisible
   *   - 64MB par tentative → bruteforce économiquement impossible
   */
  async setupPin(
    userId: string,
    pinCode: string,
  ): Promise<{ success: boolean }> {
    this.assertPinFormat(pinCode);

    const hash = await argon2.hash(pinCode, ARGON2_OPTIONS);

    await this.userRepo
      .createQueryBuilder()
      .update()
      .set({ pinCode: hash })
      .where('id = :id', { id: userId })
      .execute();

    return { success: true };
  }

  /**
   * Vérifie le PIN et retourne true si correct.
   * Le rate limiting est géré par OtpService (3 tentatives / lock 1h).
   * Appelé par AuthService.loginWithPin — pas directement exposé.
   */
  async checkPin(userId: string, pinCode: string): Promise<boolean> {
    await this.otpService.assertNotLocked('pin', userId);

    const user = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.pinCode'])
      .where('u.id = :id', { id: userId })
      .getOne();

    if (!user?.pinCode) throw new ApiError('PIN not configured.');

    const valid = await argon2.verify(user.pinCode, pinCode, ARGON2_OPTIONS);

    if (!valid) {
      await this.otpService.incrementAttempt('pin', userId);
      throw new ApiError('Invalid PIN.');
    }

    // Reset compteur après succès
    return true;
  }

  /**
   * Vérifie si un PIN est configuré pour cet utilisateur.
   * Utilisé par le mobile pour savoir s'il faut proposer le PIN au login.
   */
  async hasPinConfigured(userId: string): Promise<{ configured: boolean }> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.pinCode'])
      .where('u.id = :id', { id: userId })
      .getOne();

    return { configured: !!user?.pinCode };
  }

  /**
   * Reset PIN via OTP email.
   * Flow : sendPinOtp → utilisateur reçoit OTP → resetPin
   */
  async resetPin(
    userId: string,
    otp: string,
    newPin: string,
  ): Promise<{ success: boolean }> {
    this.assertPinFormat(newPin);
    await this.otpService.verifyOtp('pin', userId, otp);
    return this.setupPin(userId, newPin);
  }

  /** Supprime le PIN — l'utilisateur devra se reconnecter par email+password */
  async removePin(userId: string): Promise<{ success: boolean }> {
    await this.userRepo
      .createQueryBuilder()
      .update()
      .set({ pinCode: null })
      .where('id = :id', { id: userId })
      .execute();

    return { success: true };
  }

  // ── Validation PIN ────────────────────────────────────────

  private assertPinFormat(pinCode: string): void {
    if (!/^\d{4,6}$/.test(pinCode)) {
      throw new ApiError('PIN must be 4 to 6 digits.');
    }
  }

  // ── Admin ─────────────────────────────────────────────────

  async adminResetPassword(
    userIdOrEmail: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({
      where: [{ id: userIdOrEmail }, { email: userIdOrEmail }],
    });
    if (!user) throw new ApiError('User not found.');

    await this.userRepo.update(user.id, {
      password: apiHashPassword(newPassword),
    });
    await this.sessionService.deleteAllSessions(user.id);

    return { success: true };
  }

  // ── Privé ─────────────────────────────────────────────────

  private async findByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new ApiError('No account with this email.');
    return user;
  }
}
