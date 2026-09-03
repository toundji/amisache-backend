// ============================================================
// UNIFIED AUTH — notification-state.entity.ts
// État par utilisateur d'une notification de GROUPE (Notification.userId
// = null). Les notifications ciblées portent leur état lu/non-lu inline
// via Notification.readAt — pas de ligne ici pour elles.
// ============================================================
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Audit } from '../../shared/audit';
import { User } from '../../users/entities/user.entity';
import { Notification } from './notification.entity';

@Entity('notification_states')
@Index(['userId', 'notificationId'], { unique: true })
export class NotificationState extends Audit {
  static entityName = 'notification_states';

  // ── Relations ─────────────────────────────────────────────

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => Notification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification?: Notification;

  @Column({ name: 'notification_id' })
  notificationId!: string;

  // ── État ──────────────────────────────────────────────────

  @Column({ name: 'seen_at', type: 'datetime', nullable: true })
  seenAt?: Date;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt?: Date;

  @Column({ name: 'dismissed_at', type: 'datetime', nullable: true })
  dismissedAt?: Date;
}
