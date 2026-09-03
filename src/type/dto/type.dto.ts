// ============================================================
// AMISACHE — type.dto.ts
// DTOs des routes /types/*.
// ============================================================
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TypeScope } from '../type.enum';
import { Type as TypeEntity } from '../entities/type.entity';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(TypeScope, { message: 'Scope invalide.' })
  scope!: TypeScope;
}

export class UpdateTypeDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsEnum(TypeScope, { message: 'Scope invalide.' })
  @IsOptional()
  scope?: TypeScope;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
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
