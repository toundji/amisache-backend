// ============================================================
// UNIFIED AUTH — auth.service.ts
// Login, register, logout, refresh token.
// Orchestrateur — délègue aux services spécialisés.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';

import { User } from '../../users/entities/user.entity';
import { SessionService } from './session.service';
import { OtpService } from './otp.service';
import { NotificationService } from './notification.service';
import { PasswordService } from './password.service';

import {
  apiComparePasswords,
  apiGeneratePayLoad,
  apiHashPassword,
  parseUserAgent,
} from '../../utils/api-util';

import {
  redisKeys,
  JTI_BLACKLIST_TTL,
  REFRESH_TOKEN_TTL,
} from '../../utils/redis.config';

import {
  ApiError,
  ApiErrorCustomCode,
  ApiErrorDb,
} from '../../utils/api-error';

import {
  ApiClientType,
  TokenType,
  UserRole,
  UserStatus,
} from '../../shared/common.enum';
import {
  AuthResponse,
  LoginDto,
  LoginPinDto,
  RegisterDto,
  UserAuditInfo,
  GoogleAuthDto,
} from '../dto/auth.dto';

// ── Types internes ────────────────────────────────────────────

interface GoogleProfile {
  googleId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

// ── Service ───────────────────────────────────────────────────

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRedis() private redis: Redis,

    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly otpService: OtpService,
    private readonly notificationService: NotificationService,
    private readonly passwordService: PasswordService,
  ) {}

  // ── INSCRIPTION ────────────────────────────────────────────

  async register(
    body: RegisterDto,
    audit: UserAuditInfo,
  ): Promise<AuthResponse> {
    await this.assertEmailAvailable(body.email);

    const password = body.password;
    delete (body as any).password;
    delete (body as any).roles;
    delete (body as any).status;

    // Créer l'utilisateur avec mot de passe haché
    const userData = this.userRepo.create({
      ...body,
      password: apiHashPassword(password),
    });

    const user = await this.userRepo.save(userData).catch((err) => {
      throw new ApiErrorDb('users', 'create', userData, err);
    });

    // Envoyer OTP de confirmation (non bloquant)
    setImmediate(() => this.otpService.sendConfirmOtp(user));

    return this.buildAuthResponse(user, audit);
  }

  // ── LOGIN ──────────────────────────────────────────────────

  async login(body: LoginDto, audit: UserAuditInfo): Promise<AuthResponse> {
    // Vérifier le lock AVANT la DB pour économiser des requêtes
    await this.otpService.assertNotLocked('login', body.username);

    const user = await this.userRepo
      .findOne({
        where: { email: body.username },
        select: {
          id: true,
          email: true,
          password: true,
          roles: true,
          status: true,
          code: true,
          firstName: true,
          lastName: true,
          profile: true,
        },
      })
      .catch((err) => {
        throw new ApiErrorDb('users', 'findOne', { email: body.username }, err);
      });

    // Même message d'erreur pour email et password introuvables
    // (évite l'énumération d'emails côté client)
    if (!user || !apiComparePasswords(body.password, user.password ?? '')) {
      await this.otpService.incrementAttempt('login', body.username);
      throw new ApiError('Invalid credentials.', {
        customCode: ApiErrorCustomCode.AUTH_CREDENTIALS_INVALID,
        detail: !user
          ? `Login failed: email "${body.username}" not found`
          : `Login failed: wrong password for "${body.username}"`,
        level: 'warn',
      });
    }

    // Vérification accès back-office
    await this.assertClientAccess(user, audit.clientType);

    // Reset compteur d'échecs — même clé que incrementAttempt (email)
    await this.otpService.resetAttempts('login', body.username);

    // Firebase FCM (mobile — non bloquant)
    if (body.fcmToken && audit.userAgent) {
      setImmediate(() =>
        this.notificationService.subscribeToUserTopics(user.id, body.fcmToken!),
      );
    }

    return this.buildAuthResponse(user, audit, body.fcmToken);
  }

  // ── LOGIN PAR PIN (mobile uniquement) ─────────────────────

  /**
   * Appelé uniquement quand le refresh token n'est plus sur le téléphone
   * (nouveau téléphone, app réinstallée).
   *
   * Flow normal (refresh token présent) :
   *   PIN local → déchiffre refresh token → POST /auth/refresh
   *   → le backend ne voit pas le PIN
   *
   * Flow dégradé (pas de refresh token local) :
   *   PIN → POST /auth/login-pin → backend vérifie Argon2id
   *   → retourne access token + refresh token
   *   → mobile stocke le refresh token en SecureStorage
   */
  async loginWithPin(
    body: LoginPinDto,
    audit: UserAuditInfo,
  ): Promise<AuthResponse> {
    await this.otpService.assertNotLocked('pin', body.userId);

    // Charger l'utilisateur
    const user = await this.userRepo.findOne({
      where: { id: body.userId },
      select: {
        id: true,
        email: true,
        roles: true,
        status: true,
        code: true,
        firstName: true,
        lastName: true,
        profile: true,
      },
    });

    if (!user) {
      throw new ApiError('User not found.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    // Vérifier le statut avant la vérification PIN
    // (évite de consommer une tentative sur un compte bloqué)
    if (
      user.status === UserStatus.blocked ||
      user.status === UserStatus.deleted
    ) {
      throw new ApiError('Account is not accessible.', {
        code: HttpStatus.FORBIDDEN,
      });
    }

    // Vérifier le PIN via Argon2id (gère le rate limiting en interne)
    await this.passwordService.checkPin(body.userId, body.pinCode);

    // Firebase FCM (non bloquant)
    if (body.fcmToken) {
      setImmediate(() =>
        this.notificationService.subscribeToUserTopics(user.id, body.fcmToken!),
      );
    }

    return this.buildAuthResponse(user, audit, body.fcmToken);
  }

  async confirmEmail(userId: string, otp: string): Promise<AuthResponse> {
    await this.otpService.verifyOtp('confirm', userId, otp);

    await this.userRepo.update(userId, { status: UserStatus.active });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    return this.buildAuthResponse(user!, {});
  }

  async resendConfirmOtp(user: User): Promise<{ success: boolean }> {
    await this.otpService.sendConfirmOtp(user);
    return { success: true };
  }

  // ── REFRESH TOKEN ──────────────────────────────────────────

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. Vérifier la signature JWT
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
      });
    } catch {
      throw new ApiError('Invalid or expired refresh token.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    if (payload?.type !== TokenType.refresh) {
      throw new ApiError('Invalid token type.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    // 2. Vérifier en DB que le token existe et n'est pas expiré
    const session = await this.sessionService.findByRefreshToken(refreshToken);

    if (!session) {
      throw new ApiError('Session not found or refresh token already used.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    if (session.expiresAt < new Date()) {
      throw new ApiError('Session expired. Please login again.', {
        code: HttpStatus.UNAUTHORIZED,
      });
    }

    // 3. Charger l'utilisateur
    const user = await this.userRepo.findOne({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        roles: true,
        status: true,
        code: true,
      },
    });
    if (!user)
      throw new ApiError('User not found.', { code: HttpStatus.UNAUTHORIZED });

    // 4. Émettre nouveau pair de tokens + rotation
    const newAccessToken = this.signAccessToken(
      user,
      session.deviceFingerprint,
    );
    const newRefreshToken = this.signRefreshToken(
      user,
      session.deviceFingerprint,
    );

    await this.sessionService.rotateSession(
      session.userId,
      session.deviceFingerprint,
      newRefreshToken,
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // ── LOGOUT ─────────────────────────────────────────────────

  /** Logout depuis l'équipement courant */
  async logout(
    userId: string,
    jti: string,
    deviceFingerprint: string,
  ): Promise<{ success: boolean }> {
    // Blacklister le jti dans Redis (TTL = durée max access token)
    await this.redis.setex(redisKeys.jti(jti), JTI_BLACKLIST_TTL, 'revoked');

    // Supprimer la session
    await this.sessionService.deleteSession(userId, deviceFingerprint);

    return { success: true };
  }

  /** Logout depuis tous les équipements */
  async logoutAll(userId: string, jti: string): Promise<{ success: boolean }> {
    await this.redis.setex(redisKeys.jti(jti), JTI_BLACKLIST_TTL, 'revoked');
    await this.sessionService.deleteAllSessions(userId);
    return { success: true };
  }

  // ── SESSIONS (comme Telegram) ──────────────────────────────

  async getSessions(userId: string) {
    return this.sessionService.getUserSessions(userId);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean }> {
    await this.sessionService.deleteSessionById(userId, sessionId);
    return { success: true };
  }

  // ── Google Firebase Auth ──────────────────────────────────

  /**
   * Vérifie l'idToken Firebase, trouve ou crée l'utilisateur,
   * et retourne les tokens JWT internes du template.
   *
   * Le idToken est obtenu côté mobile via :
   *   FirebaseAuth.instance.currentUser?.getIdToken()
   */
  async loginWithGoogle(
    idToken: string,
    audit: UserAuditInfo,
    fcmToken?: string,
  ): Promise<AuthResponse> {
    // 1. Vérifier le idToken via Firebase Admin SDK
    // ⚠️ Import statique obligatoire — l'import dynamique `await import('firebase-admin')`
    // ré-instancie/recharge le module à l'exécution selon le bundler (webpack/ts-node),
    // ce qui a provoqué des erreurs d'initialisation en production. NotificationService
    // utilise déjà le SDK en import statique ; on aligne loginWithGoogle dessus.
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      throw new ApiError('Invalid or expired Google token.', {
        code: HttpStatus.UNAUTHORIZED,
        customCode: ApiErrorCustomCode.AUTH_TOKEN_INVALID,
        detail: `Firebase idToken verification failed: ${err instanceof Error ? err.message : err}`,
        level: 'warn',
        shouldLog: true,
      });
    }

    // 2. Trouver ou créer l'utilisateur
    const user = await this.findOrCreateGoogleUser({
      googleId: decoded.uid,
      email: decoded.email,
      firstName: decoded.name?.split(' ')[0],
      lastName: decoded.name?.split(' ').slice(1).join(' ') || undefined,
      picture: decoded.picture,
    });

    // 3. Vérifier que le compte n'est pas bloqué / supprimé
    await this.assertClientAccess(user, audit.clientType);

    // 4. FCM (mobile — non bloquant)
    if (fcmToken) {
      setImmediate(() =>
        this.notificationService.subscribeToUserTopics(user.id, fcmToken),
      );
    }

    return this.buildAuthResponse(user, audit, fcmToken);
  }

  // ── Privé ──────────────────────────────────────────────────

  /**
   * Trouve ou crée un utilisateur depuis un profil Google Firebase.
   *
   * Cas 1 — googleId connu → login direct
   * Cas 2 — email connu mais pas de googleId → lier le compte existant
   * Cas 3 — compte inconnu → créer un nouveau compte (emailVerified, pas de password)
   *
   * Vit dans AuthService (pas UserService) : c'est la seule méthode de gestion
   * de compte requise par le flux d'authentification Google — inutile d'injecter
   * tout UserService (et ses dépendances SessionService/PasswordService) pour ça.
   */
  private async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    // Cas 1 — compte déjà lié à ce googleId
    const byGoogleId = await this.userRepo.findOne({
      where: { googleId: profile.googleId },
    });
    if (byGoogleId) return byGoogleId;

    // Cas 2 — email existant → lier le googleId
    if (profile.email) {
      const byEmail = await this.userRepo.findOne({
        where: { email: profile.email },
      });
      if (byEmail) {
        await this.userRepo.update(byEmail.id, { googleId: profile.googleId });
        return this.userRepo.findOne({
          where: { id: byEmail.id },
        }) as Promise<User>;
      }
    }

    // Cas 3 — nouveau compte
    const user = this.userRepo.create({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profile: profile.picture,
      googleId: profile.googleId,
      status: UserStatus.active, // emailVerified côté Google → pas besoin de confirmation
      roles: [UserRole.user],
    });

    return this.userRepo.save(user);
  }

  private async buildAuthResponse(
    user: User,
    audit: UserAuditInfo,
    fcmToken?: string,
  ): Promise<AuthResponse> {
    // 1. Calculer le fingerprint d'abord — nécessaire pour les tokens
    const userAgent = audit.userAgent ?? audit.device ?? '';
    const device = parseUserAgent(userAgent, user.id);

    // 2. Signer les tokens avec le fingerprint
    const accessToken = this.signAccessToken(user, device.fingerprint);
    const refreshToken = this.signRefreshToken(user, device.fingerprint);

    // 3. Persister la session avec le refresh token définitif
    await this.sessionService.createSession({
      userId: user.id,
      refreshToken,
      device,
      ip: audit.ip,
      fcmToken,
    });

    // Retirer le password de la réponse
    const safeUser = { ...user };
    delete safeUser.password;

    return { accessToken, refreshToken, user: safeUser };
  }

  private signAccessToken(user: User, deviceFingerprint: string): string {
    const payload = apiGeneratePayLoad(
      user,
      TokenType.access,
      deviceFingerprint,
    );
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.getAccessTtl(user) as any,
    });
  }

  private signRefreshToken(user: User, deviceFingerprint: string): string {
    const payload = apiGeneratePayLoad(
      user,
      TokenType.refresh,
      deviceFingerprint,
    );
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
      expiresIn: `${REFRESH_TOKEN_TTL}s`,
    });
  }

  private getAccessTtl(user: User): string {
    const isAdmin = [UserRole.admin, UserRole.manager, UserRole.engineer].some(
      (r) => user.roles?.includes(r),
    );
    return isAdmin
      ? (process.env.JWT_TOKEN_EXPIRES_IN_ADMIN ?? '8h')
      : (process.env.JWT_TOKEN_EXPIRES_IN ?? '15m');
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing)
      throw new ApiError('Email already in use.', {
        customCode: ApiErrorCustomCode.AUTH_EMAIL_EXISTS,
      });
  }

  private async assertClientAccess(
    user: User,
    clientType?: ApiClientType,
  ): Promise<void> {
    const adminRoles = [UserRole.admin, UserRole.manager, UserRole.engineer];

    if (clientType === ApiClientType.back_office) {
      if (!adminRoles.some((r) => user.roles?.includes(r))) {
        throw new ApiError('Access denied. Admin access required.', {
          code: HttpStatus.FORBIDDEN,
        });
      }
    }

    if (clientType === ApiClientType.manager) {
      if (!user.roles?.includes(UserRole.agent)) {
        throw new ApiError('Access denied. Agent access required.', {
          code: HttpStatus.FORBIDDEN,
        });
      }
    }
  }
}
