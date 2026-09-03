// ============================================================
// AMISACHE — publication.dto.ts
// DTOs des routes /publications/*.
// ============================================================
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PublicationStatus } from '../community.enum';

export class CreatePublicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsUUID()
  churchId!: string;

  /** Une chorale peut publier sur sa page comme sur le fil de l'église */
  @IsUUID()
  @IsOptional()
  groupId?: string;

  /** Doit appartenir au scope PUBLICATION (validé côté service) */
  @IsUUID()
  typeId!: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class UpdatePublicationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class UpdatePublicationStatusDto {
  @IsEnum(PublicationStatus, { message: 'Statut invalide.' })
  status!: PublicationStatus;
}

export interface ListPublicationPublicQuery {
  churchId?: string;
  groupId?: string;
}

export interface ListPublicationAdminQuery extends ListPublicationPublicQuery {
  status?: PublicationStatus;
}
