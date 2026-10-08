// ============================================================
// AMISACHE — request-type.dto.ts
// DTOs des routes /request-types/*.
// ============================================================
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { RequestTypeScope } from '../request-type.enum';
import { RequestType } from '../entities/request-type.entity';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateRequestTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(RequestTypeScope, { message: 'Scope invalide.' })
  scope!: RequestTypeScope;

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

export class UpdateRequestTypeDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsEnum(RequestTypeScope, { message: 'Scope invalide.' })
  @IsOptional()
  scope?: RequestTypeScope;

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

export interface ListRequestTypePublicQuery {
  scope?: RequestTypeScope;
}

export interface ListRequestTypeAdminQuery {
  page?: number;
  limit?: number;
  scope?: RequestTypeScope;
  active?: boolean;
  search?: string;
}

export interface PaginatedRequestTypes {
  data: RequestType[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
