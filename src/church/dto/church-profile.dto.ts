// ============================================================
// AMISACHE — church-profile.dto.ts
// DTO de la route PATCH /church-profiles/church/:churchId (upsert — un seul
// champ éditable pour l'instant, extensible sans changer la forme de l'API).
// ============================================================
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertChurchProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  leaderMessage?: string;
}
