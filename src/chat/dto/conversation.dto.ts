// ============================================================
// UNIFIED AUTH — conversation.dto.ts
// DTOs des routes /chat/conversations/*.
// ============================================================
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ActorType,
  ConversationMode,
  ParticipantRole,
} from '../../shared/common.enum';
import { Conversation } from '../entities/conversation.entity';

/** Acteur supplémentaire à ajouter à la création (l'appelant est ajouté automatiquement en OWNER) */
export class AddParticipantDto {
  @IsUUID()
  actorId!: string;

  @IsEnum(ActorType, { message: "Type d'acteur invalide." })
  actorType!: ActorType;

  @IsEnum(ParticipantRole, { message: 'Rôle invalide.' })
  role!: ParticipantRole;
}

export class CreateConversationDto {
  /** Fournis ensemble — un chat rattaché à un sujet existant réutilise le fil (findOrCreate) */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  subjectType?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsEnum(ConversationMode, { message: 'Mode invalide.' })
  @IsOptional()
  mode?: ConversationMode;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AddParticipantDto)
  participants?: AddParticipantDto[];
}

export interface ListConversationsQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedConversations {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
