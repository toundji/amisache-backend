// ============================================================
// UNIFIED AUTH — message.dto.ts
// DTOs des routes /chat/conversations/:id/messages.
// ============================================================
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  FileSystemStoredFile,
  HasExtension,
  IsFiles,
  MaxFileSize,
} from 'nestjs-form-data';
import { AttachmentKind } from '../../shared/common.enum';
import { Message } from '../entities/message.entity';

export class CreateAttachmentDto {
  @IsEnum(AttachmentKind, { message: 'Type de pièce jointe invalide.' })
  kind!: AttachmentKind;

  @IsString()
  url!: string;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}

// ── kind volontairement absent : ce lot n'émet que du TEXT/MEDIA
// applicatif (pas de SYSTEM/CALL, voir prompt-claude-code-chat.md § Périmètre) ──

export class SendMessageDto {
  @IsString()
  @IsOptional()
  body?: string;

  @IsUUID()
  @IsOptional()
  replyTo?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateAttachmentDto)
  attachments?: CreateAttachmentDto[];
}

// ── Variante multipart : texte + fichiers en une seule requête ──
// (au lieu de l'aller-retour POST /chat/attachments puis SendMessageDto).

export class SendMessageWithFilesDto {
  @IsString()
  @IsOptional()
  body?: string;

  @IsUUID()
  @IsOptional()
  replyTo?: string;

  @ApiProperty({ required: false, type: 'string', isArray: true, format: 'binary' })
  @IsFiles()
  @IsOptional()
  @MaxFileSize(20e6, { each: true })
  @HasExtension(
    [
      'png', 'jpg', 'jpeg', 'webp',
      'mp4', 'mov', 'avi', 'mpeg', 'mkv',
      'mp3', 'm4a', 'wav', 'ogg', 'webm', 'aac',
      'pdf', 'doc', 'docx',
    ],
    { each: true },
  )
  files?: FileSystemStoredFile[];

  /**
   * Le sniffing par octets magiques (nestjs-form-data) ne distingue pas
   * un conteneur WebM audio-only d'un WebM vidéo — un enregistrement vocal
   * .webm est détecté comme `video/webm`. Le client (enregistreur vocal)
   * force donc explicitement AUDIO plutôt que de laisser l'API deviner.
   */
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isVoice?: boolean;
}

export interface ListMessagesQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedMessages {
  data: Message[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
