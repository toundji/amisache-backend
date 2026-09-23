// ============================================================
// AMISACHE — liturgical-period.dto.ts
// DTOs des routes /liturgical-periods/*.
// ============================================================
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { LiturgicalSeason } from '../../liturgy/liturgy.enum';

export class CreateLiturgicalPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsEnum(LiturgicalSeason, { message: 'Saison liturgique invalide.' })
  season!: LiturgicalSeason;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class UpdateLiturgicalPeriodDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;

  @IsEnum(LiturgicalSeason, { message: 'Saison liturgique invalide.' })
  @IsOptional()
  season?: LiturgicalSeason;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export interface LiturgicalPeriodSummary {
  id: string;
  name: string;
  season: LiturgicalSeason;
  startDate: string;
  endDate: string;
}

/** Réponse de GET /liturgical-periods/status */
export interface LiturgicalStatus {
  current?: LiturgicalPeriodSummary;
  next?: LiturgicalPeriodSummary & { churchesPublishedCount: number };
}
