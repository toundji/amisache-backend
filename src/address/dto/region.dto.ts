// ============================================================
// AMISACHE — region.dto.ts
// DTOs des routes /regions/*.
// ============================================================
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  parentSub?: string;

  @IsUUID()
  countryId!: string;
}

export class UpdateRegionDto {
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

export interface ListRegionQuery {
  /** Optionnel : filtre par pays. Absent → toutes les régions (back-office). */
  countryId?: string;
  search?: string;
}
