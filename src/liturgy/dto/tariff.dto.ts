// ============================================================
// AMISACHE — tariff.dto.ts
// DTOs des routes /tariffs/*.
// ============================================================
import { IsBoolean, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class CreateTariffDto {
  @IsUUID()
  churchId!: string;

  /** Doit appartenir au scope INTENTION ou SACRAMENT (validé côté service) */
  @IsUUID()
  typeId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class UpdateTariffDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export interface ListTariffQuery {
  churchId?: string;
}

/** Réponse de GET /tariffs/resolve — null si aucun tarif dans toute la hiérarchie. */
export interface ResolvedTariff {
  amount: number;
  /** Église qui a réellement défini ce tarif — peut différer de celle demandée (repli). */
  definedByChurchId: string;
  definedByChurchName: string;
}
