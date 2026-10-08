// ============================================================
// UNIFIED AUTH — handoff.dto.ts
// DTO de la route utilitaire de transfert BOT -> AGENT.
// N'émet aucun message SYSTEM (hors périmètre de ce lot).
// ============================================================
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ActorType } from '../../shared/common.enum';
import { ParticipantRole } from '../chat.enum';

export class HandoffDto {
  /**
   * actorId du participant BOT actuel (celui qui reçoit leftAt). Optionnel :
   * une conversation du widget bot (`bot-widget`) n'a pas de participant bot
   * — seul l'agent est alors ajouté, le fidèle reste participant.
   */
  @IsUUID()
  @IsOptional()
  fromActorId?: string;

  /** actorId de l'agent qui prend le relais */
  @IsUUID()
  toActorId!: string;

  @IsEnum(ActorType, { message: "Type d'acteur invalide." })
  toActorType!: ActorType;

  @IsEnum(ParticipantRole, { message: 'Rôle invalide.' })
  toRole!: ParticipantRole;
}
