// ============================================================
// AMISACHE — church-profile.dto.ts
// DTO de la route PATCH /church-profiles/church/:churchId (upsert). Les liens (site, réseaux)
// acceptent une chaîne vide pour être effacés — le service la convertit en NULL.
// ============================================================
import { IsDateString, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

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
  @ValidateIf((_, v) => v !== '')
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(500)
  website?: string;

  /** Chaîne YouTube de l'église (lien complet). */
  @ValidateIf((_, v) => v !== '')
  @IsUrl({ require_protocol: true }, { message: 'Lien YouTube invalide.' })
  @IsOptional()
  @MaxLength(500)
  youtube?: string;

  /** Page Facebook de l'église (lien complet). */
  @ValidateIf((_, v) => v !== '')
  @IsUrl({ require_protocol: true }, { message: 'Lien Facebook invalide.' })
  @IsOptional()
  @MaxLength(500)
  facebook?: string;

  /** WhatsApp : lien wa.me (numéro) ou lien de groupe / chaîne. */
  @ValidateIf((_, v) => v !== '')
  @IsUrl({ require_protocol: true }, { message: 'Lien WhatsApp invalide.' })
  @IsOptional()
  @MaxLength(500)
  whatsapp?: string;

  /** Telegram : lien t.me (canal, groupe ou compte). */
  @ValidateIf((_, v) => v !== '')
  @IsUrl({ require_protocol: true }, { message: 'Lien Telegram invalide.' })
  @IsOptional()
  @MaxLength(500)
  telegram?: string;

  /** Fin prévue du direct (ISO) ; null ou '' = direct arrêté. */
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsDateString({}, { message: 'Fin du direct invalide.' })
  @IsOptional()
  liveUntil?: string | null;

  /** Lien du direct (facultatif) ; '' = retiré. */
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsUrl({ require_protocol: true }, { message: 'Lien du direct invalide.' })
  @IsOptional()
  @MaxLength(500)
  liveUrl?: string | null;
}
