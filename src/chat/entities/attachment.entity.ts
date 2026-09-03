// ============================================================
// UNIFIED AUTH — attachment.entity.ts
// Un message = corps texte optionnel + N attachments (collection,
// pas de type composite).
// ============================================================
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Audit } from '../../shared/audit';
import { Message } from './message.entity';
import { AttachmentKind } from '../../shared/common.enum';

@Entity('chat_attachments')
export class Attachment extends Audit {
  static entityName = 'chat_attachments';

  // ── Relation ──────────────────────────────────────────────

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: Message;

  @Column({ name: 'message_id' })
  messageId!: string;

  @Column({ type: 'enum', enum: AttachmentKind })
  kind!: AttachmentKind;

  @Column()
  url!: string;

  /** JSON en longtext + collation binaire — convention du template pour les colonnes JSON */
  @Column({
    type: 'longtext',
    nullable: true,
    collation: 'utf8mb4_bin',
    transformer: {
      to: (value?: Record<string, any> | null) =>
        value == null ? null : JSON.stringify(value),
      from: (value?: string | null): Record<string, any> | null =>
        value == null ? null : (JSON.parse(value) as Record<string, any>),
    },
  })
  meta?: Record<string, any>;
}
