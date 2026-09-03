// ============================================================
// UNIFIED AUTH — jwt-auth.guard.ts
// Guards HTTP + WebSocket réutilisables.
// Aucune DB touchée ici — tout vient du middleware.
// ============================================================
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ApiError, ApiErrorCustomCode } from '../../utils/api-error';
import { ApiClientType, UserRole, UserStatus } from '../../shared/common.enum';
import { redisKeys } from '../../utils/redis.config';

// ── RequireAuthGuard ──────────────────────────────────────────
/**
 * Vérifie qu'un access token valide est présent.
 * Vérifie aussi que le jti n'est pas blacklisté (logout).
 */
@Injectable()
export class RequireAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    if (!req.user) {
      const tokenPresent = !!req.accessToken;
      const code = tokenPresent
        ? ApiErrorCustomCode.AUTH_TOKEN_INVALID
        : ApiErrorCustomCode.AUTH_TOKEN_MISSING;
      throw new ApiError('Access denied. Please login first.', {
        customCode: code,
        code: HttpStatus.UNAUTHORIZED,
        detail: tokenPresent
          ? 'JWT present but invalid (malformed or wrong secret)'
          : 'No JWT provided in Authorization header',
        level: 'warn',
      });
    }

    if (req.tokenIsExpire) {
      throw new ApiError('Access denied. Token expired.', {
        customCode: ApiErrorCustomCode.AUTH_TOKEN_EXPIRED,
        code: HttpStatus.UNAUTHORIZED,
        detail: `JWT expired for user "${req.user?.email}"`,
        level: 'warn',
      });
    }

    // Vérifier blacklist jti (logout)
    if (req.user.jti) {
      const blacklisted = await this.redis.get(redisKeys.jti(req.user.jti));
      if (blacklisted) {
        throw new ApiError('Access denied. Session revoked.', {
          customCode: ApiErrorCustomCode.AUTH_TOKEN_INVALID,
          code: HttpStatus.UNAUTHORIZED,
          detail: `JWT jti "${req.user.jti}" is blacklisted (user logged out)`,
          level: 'warn',
        });
      }
    }

    return true;
  }
}

// ── RequireRoleGuard ──────────────────────────────────────────

@Injectable()
export class RequireRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndMerge<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Engineer bypass
    if ((user.roles as string[]).includes(UserRole.engineer)) return true;

    const hasRole = requiredRoles.some((r) =>
      (user.roles as string[]).includes(r),
    );
    if (!hasRole) {
      throw new ApiError("You don't have required permissions.", {
        code: HttpStatus.FORBIDDEN,
      });
    }
    return true;
  }
}

// ── RequireUserStatusGuard ────────────────────────────────────

@Injectable()
export class RequireUserStatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) return false;

    // Statuts explicitement autorisés (ex: unverified peut accéder à /confirm)
    const allowStatus = this.reflector.getAllAndOverride<UserStatus[]>(
      'allow_status',
      [context.getHandler(), context.getClass()],
    );
    if (allowStatus?.includes(user.status)) return true;

    // Statuts requis explicitement
    const requiredStatus = this.reflector.getAllAndOverride<UserStatus[]>(
      'user_status',
      [context.getHandler(), context.getClass()],
    );
    if (requiredStatus?.length) {
      const ok = requiredStatus.includes(user.status);
      if (!ok)
        throw new ApiError('Access denied. User status not allowed.', {
          code: HttpStatus.FORBIDDEN,
          level: 'warn',
          shouldLog: true,
          detail: `User "${user.email}" (status: ${user.status}) required one of [${requiredStatus.join(', ')}]`,
        });
      return ok;
    }

    // Par défaut : active requis
    if (user.status !== UserStatus.active) {
      throw new ApiError('Access denied. Account is not active.', {
        code: HttpStatus.FORBIDDEN,
        level: 'warn',
        shouldLog: true,
        detail: `User "${user.email}" has status "${user.status}", expected "active"`,
      });
    }
    return true;
  }
}

// ── ApiKeyGuard ───────────────────────────────────────────────

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const noKey = this.reflector.getAllAndOverride<boolean>('noKey', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (noKey) return true;

    const req = context.switchToHttp().getRequest();

    if (!req.apikey?.token) {
      throw new ApiError('Invalid API key. External access is forbidden.', {
        code: HttpStatus.UNAUTHORIZED,
        customCode: ApiErrorCustomCode.AUTH_API_KEY_MISSING,
        detail: 'No API key provided in request headers',
        level: 'warn',
      });
    }

    if (!req.apikey.valid) {
      throw new ApiError('Invalid API key. External access is forbidden.', {
        code: HttpStatus.UNAUTHORIZED,
        customCode: ApiErrorCustomCode.AUTH_API_KEY_INVALID,
        detail: `API key "${req.apikey.token.slice(0, 8)}..." not recognized`,
        level: 'warn',
      });
    }

    return true;
  }
}

// ── RequireClientTypeGuard ────────────────────────────────────
/**
 * Restreint une route aux clients dont la clé API correspond au(x)
 * ApiClientType déclaré(s) via @RequireClientType(...). Sans le décorateur,
 * la route reste accessible depuis n'importe quel client valide (ApiKeyGuard
 * a déjà vérifié que la clé existe et est reconnue).
 *
 * Différence avec RequireRoleGuard : celui-ci vérifie le rôle du compte
 * (JWT), celui-là vérifie l'origine de l'appel (clé API) — les deux sont
 * indépendants et cumulables.
 */
@Injectable()
export class RequireClientTypeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowedTypes = this.reflector.getAllAndMerge<ApiClientType[]>(
      'clientTypes',
      [context.getHandler(), context.getClass()],
    );
    if (!allowedTypes?.length) return true;

    const req = context.switchToHttp().getRequest();
    const clientType: ApiClientType | undefined = req.apikey?.type;

    if (!clientType || !allowedTypes.includes(clientType)) {
      throw new ApiError('Access denied from this client.', {
        code: HttpStatus.FORBIDDEN,
        detail: `clientType "${clientType}" not in [${allowedTypes.join(', ')}]`,
        level: 'warn',
      });
    }

    return true;
  }
}

// ── WebSocketAuthGuard ────────────────────────────────────────

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const user = client.handshake?.user;

    if (!user || client.handshake?.tokenIsExpire) {
      client.emit('error', {
        code: user ? 'WS_TOKEN_EXPIRED' : 'WS_AUTH_REQUIRED',
        message: user ? 'Token expired.' : 'Authentication required.',
      });
      client.disconnect(true);
      return false;
    }

    return true;
  }
}
