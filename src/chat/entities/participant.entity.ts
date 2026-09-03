// ============================================================
// UNIFIED AUTH — participant.entity.ts
// Porte TOUTE l'appartenance à une conversation. joinedAt/leftAt =
// intervalle d'appartenance ; leftAt IS NULL = actif. Handoff
// BOT->AGENT : leftAt sur le bot + nouveau Participant agent.
// ============================================================
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Audit } from '../../shared/audit';
import { Conversation } from './conversation.entity';
import { ActorType, ParticipantRole } from '../../shared/common.enum';

@Entity('chat_participants')
@Index(['actorId', 'leftAt'])
export class Participant extends Audit {
  static entityName = 'chat_participants';

  // ── Relation ──────────────────────────────────────────────

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Index()
  @Column({ name: 'conversation_id' })
  conversationId!: string;

  // ── Identité — UUID nu, pas de FK (voir note polymorphisme du prompt chat) ──

  @Column({ name: 'actor_id' })
  actorId!: string;

  @Column({ type: 'enum', enum: ActorType, name: 'actor_type' })
  actorType!: ActorType;

  @Column({ type: 'enum', enum: ParticipantRole })
  role!: ParticipantRole;

  // ── Intervalle d'appartenance ─────────────────────────────

  @Column({
    name: 'joined_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'datetime', nullable: true })
  leftAt?: Date;

  /** Curseur de lecture — non-lu = COUNT(message WHERE createdAt > lastReadAt AND senderId <> actorId) */
  @Column({ name: 'last_read_at', type: 'datetime', nullable: true })
  lastReadAt?: Date;
}
