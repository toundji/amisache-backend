// ============================================================
// AMISACHE — country.dto.ts
// DTOs des routes /countries/*.
// ============================================================
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateCountryDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 2, { message: "isoCode doit faire 2 caractères (ISO 3166-1 alpha-2)." })
  isoCode!: string;

  @IsString()
  @IsNotEmpty()
  callingCode!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  subdivisions!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  allSub!: string[];
}

export class UpdateCountryDto {
  @IsString()
  @IsOptional()
  callingCode?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  subdivisions?: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  allSub?: string[];
}

// ── Requête de liste ─────────────────────────────────────────────

export interface ListCountryQuery {
  search?: string;
}
