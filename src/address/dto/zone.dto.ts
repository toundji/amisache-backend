// ============================================================
// AMISACHE — zone.dto.ts
// DTOs des routes /zones/*.
// ============================================================
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  parentSub?: string;

  @IsUUID()
  regionId!: string;
}

export class UpdateZoneDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  parentSub?: string;
}

// ── Requête de liste ─────────────────────────────────────────────

export interface ListZoneQuery {
  /** Optionnel : filtre par région. Absent → toutes les zones (back-office). */
  regionId?: string;
  search?: string;
}
