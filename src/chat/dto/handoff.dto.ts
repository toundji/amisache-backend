// ============================================================
// UNIFIED AUTH — handoff.dto.ts
// DTO de la route utilitaire de transfert BOT -> AGENT.
// N'émet aucun message SYSTEM (hors périmètre de ce lot).
// ============================================================
import { IsEnum, IsUUID } from 'class-validator';
import { ActorType, ParticipantRole } from '../../shared/common.enum';

export class HandoffDto {
  /** actorId du participant BOT actuel (celui qui reçoit leftAt) */
  @IsUUID()
  fromActorId!: string;

  /** actorId de l'agent qui prend le relais */
  @IsUUID()
  toActorId!: string;

  @IsEnum(ActorType, { message: "Type d'acteur invalide." })
  toActorType!: ActorType;

  @IsEnum(ParticipantRole, { message: 'Rôle invalide.' })
  toRole!: ParticipantRole;
}
