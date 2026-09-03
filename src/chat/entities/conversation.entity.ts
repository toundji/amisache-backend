// ============================================================
// UNIFIED AUTH — conversation.entity.ts
// Pur contenant — ne porte AUCUNE identité d'acteur. Toute
// l'appartenance vit dans Participant (propriétaire éventuel =
// Participant WHERE role = OWNER). Voir chat-model.mermaid.
// ============================================================
import { Entity, Column, Index } from 'typeorm';
import { Audit } from '../../shared/audit';
import { ConversationStatus, ConversationMode } from '../../shared/common.enum';

@Entity('chat_conversations')
@Index(['subjectType', 'subjectId'])
export class Conversation extends Audit {
  static entityName = 'chat_conversations';

  /** Lien polymorphe vers l'entité métier (course, demande, commande…), sans FK — null = chat libre */
  @Column({ name: 'subject_type', nullable: true })
  subjectType?: string;

  @Column({ name: 'subject_id', nullable: true })
  subjectId?: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.OPEN,
  })
  status!: ConversationStatus;

  @Column({
    type: 'enum',
    enum: ConversationMode,
    default: ConversationMode.AGENT,
  })
  mode!: ConversationMode;

  // ── Cache liste — dénormalisé, mis à jour à chaque message ──

  @Index()
  @Column({ name: 'last_message_at', type: 'datetime', nullable: true })
  lastMessageAt?: Date;

  @Column({ name: 'last_message_preview', nullable: true })
  lastMessagePreview?: string;

  /** UUID nu, pas de FK — même polymorphisme que Message.senderId */
  @Column({ name: 'last_message_sender_id', nullable: true })
  lastMessageSenderId?: string;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt?: Date;
}
