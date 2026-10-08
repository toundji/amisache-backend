// ============================================================
// AMISACHE — type.dto.ts
// DTOs des routes /types/*.
// ============================================================
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { TypeScope } from '../type.enum';
import { Type as TypeEntity } from '../entities/type.entity';

// INTENTION/SACRAMENT vivent désormais dans une table dédiée (RequestType,
// liturgy/) — voir EVOLUTION.md 2026-09-26. Exclus ici pour ne pas laisser
// créer un doublon inerte dans `types`, jamais lu par aucun service.
const CREATABLE_SCOPES = [TypeScope.DONATION, TypeScope.PUBLICATION, TypeScope.SCHEDULE];

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(CREATABLE_SCOPES, { message: 'Scope invalide — les intentions/sacrements se créent via /request-types.' })
  scope!: TypeScope;

  /** Pertinent seulement pour INTENTION/SACRAMENT — ignoré sinon */
  @IsBoolean()
  @IsOptional()
  allowHomeCelebration?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  minLeadDays?: number;

  @IsBoolean()
  @IsOptional()
  requiresScheduleMatch?: boolean;
}

export class UpdateTypeDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsIn(CREATABLE_SCOPES, { message: 'Scope invalide — les intentions/sacrements se créent via /request-types.' })
  @IsOptional()
  scope?: TypeScope;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsBoolean()
  @IsOptional()
  allowHomeCelebration?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  minLeadDays?: number;

  @IsBoolean()
  @IsOptional()
  requiresScheduleMatch?: boolean;
}

// ── Requêtes de liste ────────────────────────────────────────────

export interface ListTypePublicQuery {
  /** Obligatoire côté service : une entité ne référence que son propre scope */
  scope?: TypeScope;
}

export interface ListTypeAdminQuery {
  page?: number;
  limit?: number;
  scope?: TypeScope;
  active?: boolean;
  search?: string;
}

export interface PaginatedTypes {
  data: TypeEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
