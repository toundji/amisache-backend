// ============================================================
// AMISACHE — schedule.dto.ts
// DTOs des routes /schedules/*.
// ============================================================
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LiturgicalSeason, ScheduleFrequency } from '../liturgy.enum';

export class CreateScheduleDto {
  @IsEnum(ScheduleFrequency, { message: 'Fréquence invalide.' })
  frequency!: ScheduleFrequency;

  /** 0 (dimanche) à 6 (samedi) */
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  /** 1 à 5 (ex: 2 = « 2ᵉ dimanche du mois ») — MONTHLY uniquement */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  weekOfMonth?: number;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'time doit être au format HH:mm.' })
  time!: string;

  @IsInt()
  @IsPositive()
  duration!: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;

  @IsEnum(LiturgicalSeason, { message: 'Saison liturgique invalide.' })
  @IsOptional()
  season?: LiturgicalSeason;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  churchId!: string;

  /** Doit appartenir au scope SCHEDULE (validé côté service via TypeService) */
  @IsUUID()
  typeId!: string;
}

export class UpdateScheduleDto {
  @IsEnum(ScheduleFrequency, { message: 'Fréquence invalide.' })
  @IsOptional()
  frequency?: ScheduleFrequency;

  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  weekOfMonth?: number;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'time doit être au format HH:mm.' })
  @IsOptional()
  time?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;

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

export interface ListScheduleQuery {
  /** Obligatoire côté service — un horaire référence toujours son église */
  churchId: string;
}
