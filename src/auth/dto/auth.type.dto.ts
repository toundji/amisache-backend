// ============================================================
// UNIFIED AUTH — auth.types.ts
// Types partagés liés à l'authentification.
// Importés par le middleware, les guards, les controllers.
// ============================================================

import { Request } from 'express';
import { TokenType, UserStatus } from '../../shared/common.enum';

// ── Payload JWT désérialisé (contenu de req.user) ─────────────

export class JwtUserInfo {
  id!: string;
  email!: string;
  status!: UserStatus;
  roles!: string[];
  type!: TokenType;
  jti!: string;
  deviceFingerprint!: string;
}

// ── Extension de la requête Express ──────────────────────────

export interface AuthApiRequest extends Request {
  user?: JwtUserInfo;
  userCrypt?: unknown;
  accessToken?: string;
  tokenIsExpire?: boolean;
  apikey?: { token: string; valid: boolean; type?: string };
  userIp?: string;
  userDevice?: string;
}
