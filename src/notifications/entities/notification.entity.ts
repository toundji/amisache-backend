// ============================================================
// UNIFIED AUTH — notification.entity.ts
// Entité unique pour les notifications ciblées et de groupe.
// userId = null -> notification de groupe/broadcast, l'état
// lu/vu/dismiss par utilisateur vit alors dans NotificationState.
// Pas de colonne url — la redirection est dérivée côté front
// via un registre type -> route appliqué sur `data`.
// ============================================================
import { Entity, Column, Index } from 'typeorm';
import { Audit } from '../../shared/audit';

@Entity('notifications')
export class Notification extends Audit {
  static entityName = 'notifications';

  /** null = notification de groupe/broadcast */
  @Index()
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId?: string;

  @Index()
  @Column()
  type!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'json', nullable: true })
  data?: Record<string, any>;

  /**
   * Clé de déduplication déterministe (scope + type + id_métier), fournie
   * par l'appelant. Index unique — insert via .orIgnore(), voir NotificationService.notify().
   */
  @Index({ unique: true })
  @Column({ name: 'dedup_key' })
  dedupKey!: string;

  /** Purgée par le cron une fois dépassée — voir NotificationService.purge() */
  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date;

  /** Porte l'état lu/non-lu UNIQUEMENT pour les notifications ciblées (userId non-null) */
  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt?: Date;
}
