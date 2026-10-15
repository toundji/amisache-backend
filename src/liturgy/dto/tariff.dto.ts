// ============================================================
// AMISACHE — tariff.dto.ts
// DTOs des routes /tariffs/*.
// ============================================================
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class CreateTariffDto {
  @IsUUID()
  churchId!: string;

  /** Doit appartenir au scope INTENTION ou SACRAMENT (validé côté service) */
  @IsUUID()
  typeId!: string;

  /** Au moins un des deux (montant, délai) — vérifié côté service */
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  /** Délai minimum en heures (24 = 1 jour, 168 = 1 semaine). */
  @IsInt()
  @Min(0)
  @Max(8760)
  @IsOptional()
  minLeadHours?: number;
}

export class UpdateTariffDto {
  /** null = retirer le montant (il se résout alors plus haut) */
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number | null;

  /** null = retirer le délai (il se résout alors plus haut) */
  @IsInt()
  @Min(0)
  @Max(8760)
  @IsOptional()
  minLeadHours?: number | null;

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

/** Réponse de GET /tariffs/min-lead-hours — toujours une valeur (repli final : Type.minLeadHours). */
export interface ResolvedMinLeadHours {
  minLeadHours: number;
  /** Église qui a fixé ce délai — null : valeur par défaut du type (plateforme). */
  definedByChurchId: string | null;
  definedByChurchName: string | null;
}
