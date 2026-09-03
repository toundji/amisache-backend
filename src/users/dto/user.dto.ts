// ============================================================
// UNIFIED AUTH — user.dto.ts
// DTOs des routes /users/*.
// ============================================================

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUrl,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { UserRole, UserStatus } from '../../shared/common.enum';
import { User } from '../entities/user.entity';

// ── Profil personnel ──────────────────────────────────────────

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsUrl({}, { message: "L'URL de l'avatar est invalide." })
  @IsOptional()
  profile?: string;
}

// ── Admin ─────────────────────────────────────────────────────

export class AdminResetPasswordDto {
  /** userId ou email */
  @IsString()
  @IsNotEmpty()
  userIdOrEmail!: string;

  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  newPassword!: string;
}

export class AdminUpdateStatusDto {
  @IsEnum(UserStatus, { message: 'Statut invalide.' })
  status!: UserStatus;
}

export class AdminUpdateRolesDto {
  @IsArray()
  @IsEnum(UserRole, {
    each: true,
    message: 'Un ou plusieurs rôles sont invalides.',
  })
  roles!: UserRole[];
}

// ── Pagination / filtres ──────────────────────────────────────

/** Colonnes autorisées pour le tri — whitelist, jamais de nom de colonne brut venant du client. */
export type ListUsersSortBy =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'status'
  | 'createdAt';

export interface ListUsersQuery {
  /** Numéro de page, commence à 1 (défaut: 1) */
  page?: number;
  /** Nombre d'éléments par page (défaut: 20, max: 100) */
  limit?: number;
  /** Filtrer par statut */
  status?: UserStatus;
  /** Filtrer par rôle */
  role?: UserRole;
  /** Recherche libre sur email, firstName, lastName */
  search?: string;
  /** Colonne de tri (défaut: createdAt) */
  sortBy?: ListUsersSortBy;
  /** Sens du tri (défaut: desc) */
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  data: Partial<User>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
