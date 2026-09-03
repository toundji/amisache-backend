// ============================================================
// AMISACHE — media.dto.ts (community/)
// DTOs des routes /media/*.
// ⚠️ Distinct de shared/media.dto.ts (DTOs d'upload multipart génériques,
// réutilisés ici pour l'upload d'un fichier avant AddMediaDto).
// ============================================================
import { IsEnum, IsNotEmpty, IsUUID, IsUrl } from 'class-validator';
import { MediaKind, MediaProvider } from '../community.enum';

export class AddMediaDto {
  @IsEnum(MediaKind, { message: 'Type de média invalide.' })
  kind!: MediaKind;

  @IsEnum(MediaProvider, { message: 'Fournisseur de média invalide.' })
  provider!: MediaProvider;

  @IsUrl()
  url!: string;

  @IsUUID()
  publicationId!: string;
}

export class ListMediaQuery {
  @IsUUID()
  @IsNotEmpty()
  publicationId!: string;
}
