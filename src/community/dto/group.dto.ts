// ============================================================
// AMISACHE — group.dto.ts
// DTOs des routes /groups/*.
// ============================================================
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { GroupType } from '../community.enum';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(GroupType, { message: 'Type de groupe invalide.' })
  type!: GroupType;

  @IsUUID()
  churchId!: string;
}

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsEnum(GroupType, { message: 'Type de groupe invalide.' })
  @IsOptional()
  type?: GroupType;
}

export interface ListGroupQuery {
  /** Obligatoire côté service — un groupe référence toujours son église */
  churchId: string;
}
