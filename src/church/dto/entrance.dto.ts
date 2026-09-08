// ============================================================
// AMISACHE — entrance.dto.ts
// DTOs des routes /entrances/*.
// ============================================================
import { Type as TransformType } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EntranceType } from '../church.enum';
import { LocationDto } from '../../address/dto/address.dto';

export class CreateEntranceDto {
  @IsEnum(EntranceType, { message: "Type d'entrée invalide." })
  type!: EntranceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ValidateNested()
  @TransformType(() => LocationDto)
  location!: LocationDto;

  @IsUUID()
  churchId!: string;
}

export class UpdateEntranceDto {
  @IsEnum(EntranceType, { message: "Type d'entrée invalide." })
  @IsOptional()
  type?: EntranceType;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ValidateNested()
  @TransformType(() => LocationDto)
  @IsOptional()
  location?: LocationDto;
}

export interface ListEntranceQuery {
  /** Optionnel : filtre par église. Absent → toutes les entrées (back-office). */
  churchId?: string;
}
