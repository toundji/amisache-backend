// ============================================================
// AMISACHE — address.dto.ts
// DTO de l'objet-valeur Address, à embarquer (nested validation)
// dans les DTOs des entités hôtes (ex: CreateChurchDto.address).
// ============================================================
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Coordonnées GPS en entrée — [longitude, latitude] à l'ordre GeoJSON
 * est source d'erreurs côté client mobile ; on accepte lat/lng nommés
 * et on reconstruit le `Point` GeoJSON côté service.
 */
export class LocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class AddressDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  locality?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  landmark?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;

  @IsUUID()
  zoneId!: string;

  @IsUUID()
  @IsOptional()
  villageId?: string;
}
