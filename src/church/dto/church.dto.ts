// ============================================================
// AMISACHE — church.dto.ts
// DTOs des routes /churches/*.
// ============================================================
import { Type as TransformType } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsHexColor,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EntityType, ValidationStatus } from '../church.enum';
import { AddressDto } from '../../address/dto/address.dto';
import { Church } from '../entities/church.entity';

// ── Création / mise à jour ───────────────────────────────────────

export class CreateChurchDto {
  @IsEnum(EntityType, { message: "Type d'entité invalide." })
  type!: EntityType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  /** Généré depuis `name` si absent — voir ChurchService.prepareSlug */
  @IsString()
  @IsOptional()
  @MaxLength(160)
  slug?: string;

  @IsString()
  @IsOptional()
  leaderMessage?: string;

  @IsHexColor({ message: 'accentColor doit être une couleur hexadécimale (#RRGGBB).' })
  @IsOptional()
  accentColor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultLanguage?: string;

  /** Absent uniquement pour le niveau CONFERENCE (racine de la hiérarchie) */
  @IsUUID()
  @IsOptional()
  parentId?: string;

  /** Requis uniquement pour le niveau CONFERENCE */
  @IsUUID()
  @IsOptional()
  countryId?: string;

  @ValidateNested()
  @TransformType(() => AddressDto)
  address!: AddressDto;
}

export class UpdateChurchDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  slug?: string;

  @IsString()
  @IsOptional()
  leaderMessage?: string;

  @IsHexColor({ message: 'accentColor doit être une couleur hexadécimale (#RRGGBB).' })
  @IsOptional()
  accentColor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultLanguage?: string;

  @ValidateNested()
  @TransformType(() => AddressDto)
  @IsOptional()
  address?: AddressDto;
}

export class UpdateChurchStatusDto {
  @IsEnum(ValidationStatus, { message: 'Statut invalide.' })
  status!: ValidationStatus;
}

// ── Emprise géographique (§7.5 — 4 à 20 sommets, ring fermé par le service) ──

export class PerimeterPointDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class SetPerimeterDto {
  @ValidateNested({ each: true })
  @TransformType(() => PerimeterPointDto)
  @ArrayMinSize(4, { message: "L'emprise doit avoir au moins 4 sommets." })
  @ArrayMaxSize(20, { message: "L'emprise ne peut pas dépasser 20 sommets." })
  points!: PerimeterPointDto[];
}

// ── Requêtes de liste ────────────────────────────────────────────

export interface ListChurchPublicQuery {
  type?: EntityType;
  parentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListChurchAdminQuery extends ListChurchPublicQuery {
  status?: ValidationStatus;
}

export interface PaginatedChurches {
  data: Church[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
