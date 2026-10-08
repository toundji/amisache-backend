// ============================================================
// AMISACHE — church-profile.dto.ts
// DTO de la route PATCH /church-profiles/church/:churchId (upsert — un seul
// champ éditable pour l'instant, extensible sans changer la forme de l'API).
// ============================================================
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpsertChurchProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  leaderMessage?: string;

  /** Site web propre à l'église (certaines en ont déjà un) — affiché comme lien sur sa fiche publique. */
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  website?: string;
}
