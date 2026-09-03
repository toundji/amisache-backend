// ============================================================
// UNIFIED AUTH — api-middleware.ts
// Désérialisation HTTP + WebSocket.
// Populé avant les guards — aucune DB touchée ici.
// ============================================================
import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { getApiClientType, parseUserAgent } from '../../utils/api-util';
import { TokenType } from '../../shared/common.enum';
import 'dotenv/config';
import { AuthApiRequest } from '../../auth/dto/auth.type.dto';

const requestIp = require('request-ip');

// ── HTTP Middleware ───────────────────────────────────────────

@Injectable()
export class ApiDeserializationMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: AuthApiRequest, _res: Response, next: NextFunction): void {
    // 1 ── API Key ────────────────────────────────────────
    const apiKey = this.extractApiKey(req)?.trim();
    if (apiKey) {
      const clientType = getApiClientType(apiKey);
      req.apikey = {
        token: apiKey,
        valid: !!clientType,
        type: clientType ?? undefined,
      };
    }

    // 2 ── JWT Bearer ──────────────────────────────────────
    const token = this.extractBearerToken(req);
    req.accessToken = token;

    if (token) {
      try {
        // ignoreExpiration=true : lire le payload même si expiré
        // pour distinguer "token invalide" vs "token expiré"
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
          ignoreExpiration: true,
        });

        // Refuser les refresh tokens sur les routes normales
        if (payload?.type === TokenType.refresh) {
          // req.user reste undefined — le guard rejettera
        } else {
          req.user = {
            id: payload.sub,
            email: payload.email,
            status: payload.status,
            roles: payload.roles,
            type: payload.type,
            jti: payload.jti,
            deviceFingerprint: payload.dfp ?? '',
          };
          req.userCrypt = payload;
        }

        // Vérifier l'expiration séparément
        try {
          this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
        } catch {
          req.tokenIsExpire = true;
        }
      } catch {
        // Token malformé — on continue sans user
      }
    }

    // 3 ── IP + Device ─────────────────────────────────────
    try {
      req.userIp = requestIp.getClientIp(req);
      const ua = req.get('user-agent') ?? '';
      const parsed = parseUserAgent(ua, req.user?.id ?? 'anonymous');
      req.userDevice = `${parsed.deviceName} / ${parsed.os}`;
    } catch {
      // Non bloquant
    }

    next();
  }

  private extractBearerToken(req: Request): string | undefined {
    const [type, token] = req.headers?.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractApiKey(req: Request): string | undefined {
    const headerName = process.env.API_KEY_HEADER_NAME ?? 'api-key';
    return req.headers[headerName] as string | undefined;
  }
}

// ── WebSocket Middleware ──────────────────────────────────────

@Injectable()
export class WebSocketAuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(socket: any, next: (err?: any) => void): void {
    if (!socket?.handshake) {
      return next(new Error('No handshake'));
    }

    const token = this.extractTokenFromSocket(socket);
    socket.handshake.accessToken = token;

    if (!token) {
      return next(); // Guard décidera
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      // Refuser les refresh tokens sur le WS
      if (payload?.type === TokenType.refresh) {
        return next();
      }

      socket.handshake.user = {
        id: payload.sub,
        email: payload.email,
        status: payload.status,
        roles: payload.roles,
        type: payload.type,
        jti: payload.jti,
        deviceFingerprint: payload.dfp ?? '',
      };
      socket.handshake.userCrypt = payload;
    } catch {
      socket.handshake.tokenIsExpire = true;
    }

    next();
  }

  private extractTokenFromSocket(socket: any): string | undefined {
    // 1. socket.handshake.auth.token (recommandé Socket.io v4+)
    const authToken = socket.handshake?.auth?.token;
    if (authToken) return authToken;

    // 2. Authorization header
    const [type, token] = (
      socket.handshake?.headers?.authorization ?? ''
    ).split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
