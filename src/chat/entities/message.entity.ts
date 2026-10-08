// ============================================================
// UNIFIED AUTH — message.entity.ts
// createdAt (hérité d'Audit) = instant d'émission, pas de sentAt
// séparé. deliveredAt/readAt = suivi 1-à-1 (multi-destinataire ->
// MessageReceipt, hors périmètre de ce lot).
// ============================================================
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Audit } from '../../shared/audit';
import { Conversation } from './conversation.entity';
import { Attachment } from './attachment.entity';
import { ActorType, MessageKind } from '../../shared/common.enum';

/** Réponse rapide proposée sous un message — `value` : texte envoyé au clic (défaut : `label`). */
export interface MessageOption {
  label: string;
  value?: string;
}

@Entity('chat_messages')
@Index(['conversationId', 'createdAt'])
export class Message extends Audit {
  static entityName = 'chat_messages';

  // ── Relation ──────────────────────────────────────────────

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  // ── Émetteur — UUID nu, pas de FK (null si SYSTEM) ────────

  @Column({ name: 'sender_id', nullable: true })
  senderId?: string;

  @Column({ type: 'enum', enum: ActorType, name: 'sender_type' })
  senderType!: ActorType;

  @Column({ type: 'enum', enum: MessageKind, default: MessageKind.TEXT })
  kind!: MessageKind;

  @Column({ type: 'longtext', nullable: true })
  body?: string;

  // ── Réponse — auto-référence, pas de cascade ──────────────

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reply_to' })
  replyToMessage?: Message;

  @Column({ name: 'reply_to', nullable: true })
  replyTo?: string;

  // ── Suivi 1-à-1 (voir note d'en-tête) ─────────────────────

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt?: Date;

  /** Échec d'envoi */
  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failedAt?: Date;

  /**
   * Suppression par l'expéditeur — distinct du soft-delete générique
   * `Audit.deletedAt` (qui masquerait la ligne des requêtes) : le message
   * reste visible dans le fil comme placeholder « Message supprimé »,
   * body vidé et attachments supprimés (DB + disque).
   */
  @Column({ name: 'content_deleted_at', type: 'datetime', nullable: true })
  contentDeletedAt?: Date;

  /**
   * Trace technique d'une réponse du bot (tools appelés, durée, modèle,
   * `fallback`) — jamais affichée, jamais renvoyée par l'API (`select: false`).
   * JSON en longtext + collation binaire — convention du template.
   */
  @Column({
    type: 'longtext',
    nullable: true,
    select: false,
    collation: 'utf8mb4_bin',
    transformer: {
      to: (value?: Record<string, any> | null) =>
        value == null ? null : JSON.stringify(value),
      from: (value?: string | null): Record<string, any> | null =>
        value == null ? null : (JSON.parse(value) as Record<string, any>),
    },
  })
  meta?: Record<string, any>;

  /**
   * Choix cliquables proposés sous un message du bot (réponses rapides) —
   * au clic, le client envoie `value ?? label` comme un message normal.
   * Renvoyés par l'API, contrairement à `meta`.
   */
  @Column({
    type: 'longtext',
    nullable: true,
    collation: 'utf8mb4_bin',
    transformer: {
      to: (value?: MessageOption[] | null) => (value?.length ? JSON.stringify(value) : null),
      from: (value?: string | null): MessageOption[] | null =>
        value == null ? null : (JSON.parse(value) as MessageOption[]),
    },
  })
  options?: MessageOption[] | null;

  /** Chargée à la demande via `relations: ['attachments']` (eager: false) */
  @OneToMany(() => Attachment, (attachment) => attachment.message)
  attachments?: Attachment[];
}
