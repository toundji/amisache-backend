// ============================================================
// UNIFIED AUTH — setting.dto.ts
// DTOs des routes /settings/*.
// ============================================================
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';
import { SettingType } from '../../shared/common.enum';
import { Setting } from '../entities/setting.entity';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateSettingDto {
  /** Convention majuscules/underscore, ex. APP_MAINTENANCE_MODE — évite les doublons de casse */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'key doit être en MAJUSCULES avec underscores (ex. APP_NAME).',
  })
  key!: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsEnum(SettingType, { message: 'Type invalide.' })
  @IsOptional()
  type?: SettingType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  isEditable?: boolean;
}

export class UpdateSettingDto {
  /** Seule `value` est modifiable pour un setting non éditable (voir SettingService.update) */
  @IsString()
  @IsOptional()
  value?: string;

  @IsEnum(SettingType, { message: 'Type invalide.' })
  @IsOptional()
  type?: SettingType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  isEditable?: boolean;
}

// ── Requêtes de liste ────────────────────────────────────────────

export interface ListSettingAdminQuery {
  category?: string;
  search?: string;
}

export interface PaginatedSettings {
  data: Setting[];
  total: number;
}
