// ============================================================
// AMISACHE — village.dto.ts
// DTOs des routes /villages/*.
// ============================================================
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VillageType } from '../address.enum';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateVillageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(VillageType, { message: 'Type de village invalide.' })
  type!: VillageType;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  parentSub?: string;

  @IsUUID()
  zoneId!: string;
}

export class UpdateVillageDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsEnum(VillageType, { message: 'Type de village invalide.' })
  @IsOptional()
  type?: VillageType;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  parentSub?: string;
}

// ── Requête de liste ─────────────────────────────────────────────

export interface ListVillageQuery {
  /** Optionnel : filtre par zone. Absent → tous les villages (back-office). */
  zoneId?: string;
  search?: string;
}
