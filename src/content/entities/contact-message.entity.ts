// ============================================================
// UNIFIED AUTH — contact-message.entity.ts
// Message soumis via le formulaire de contact public.
// Pas de lien avec un compte User — visiteur anonyme.
// ============================================================
import { Entity, Column } from 'typeorm';
import { Audit } from '../../shared/audit';
import { ContactMessageStatus } from '../../shared/common.enum';

@Entity('contact_messages')
export class ContactMessage extends Audit {
  static entityName = 'contact_messages';

  @Column()
  name!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({
    type: 'enum',
    enum: ContactMessageStatus,
    default: ContactMessageStatus.new,
  })
  status!: ContactMessageStatus;

  /** Note interne laissée par l'admin qui a traité le message */
  @Column({ type: 'text', nullable: true, name: 'admin_note' })
  adminNote?: string;

  /** IP du visiteur au moment de l'envoi — contexte anti-spam */
  @Column({ nullable: true })
  ip?: string;

  /** Renseigné automatiquement quand status passe à `read` */
  @Column({ type: 'datetime', nullable: true, name: 'read_at' })
  readAt?: Date;

  /** Renseigné automatiquement quand status passe à `treated` */
  @Column({ type: 'datetime', nullable: true, name: 'answered_at' })
  answeredAt?: Date;
}
