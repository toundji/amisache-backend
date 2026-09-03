// ============================================================
// AMISACHE — clergy-member.dto.ts
// DTOs des routes /clergy-members/*.
// ============================================================
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EcclesialRole } from '../church.enum';

export class CreateClergyMemberDto {
  @IsEnum(EcclesialRole, { message: 'Fonction ecclésiale invalide.' })
  role!: EcclesialRole;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  churchId!: string;

  @IsUUID()
  userId!: string;
}

export class UpdateClergyMemberDto {
  @IsEnum(EcclesialRole, { message: 'Fonction ecclésiale invalide.' })
  @IsOptional()
  role?: EcclesialRole;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  /** Renseigner met fin à l'affectation */
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export interface ListClergyMemberQuery {
  /** Obligatoire côté service — une affectation référence toujours son église */
  churchId: string;
  /** true = uniquement les affectations actives (endDate vide) */
  activeOnly?: boolean;
}
