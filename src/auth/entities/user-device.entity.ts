// ============================================================
// UNIFIED AUTH — user-device.entity.ts
// Représente un équipement physique enregistré.
// Lié à l'utilisateur, pas à la session.
// Le fcmToken survit à l'expiration de session.
// ============================================================
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Audit } from '../../shared/audit';
import { User } from '../../users/entities/user.entity';
import { DeviceType } from '../../shared/common.enum';

@Entity('user_devices')
export class UserDevice extends Audit {
  static entityName = 'user_devices';

  // ── Relation ──────────────────────────────────────────────

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  // ── Empreinte unique de l'équipement ─────────────────────

  /**
   * Hash SHA-256 de (userId + deviceName + os + deviceType).
   * Permet l'upsert : même équipement = même ligne.
   */
  @Index({ unique: true })
  @Column({ name: 'device_fingerprint', length: 64 })
  deviceFingerprint!: string;

  // ── Infos équipement ─────────────────────────────────────

  @Column({ nullable: true, name: 'device_name' })
  deviceName?: string;

  @Column({
    nullable: true,
    name: 'device_type',
    enum: DeviceType,
    type: 'enum',
    default: DeviceType.unknown,
  })
  deviceType?: DeviceType;

  @Column({ nullable: true })
  os?: string;

  /** Navigateur — null si application mobile native */
  @Column({ nullable: true })
  browser?: string;

  // ── Notification ─────────────────────────────────────────

  /**
   * Firebase Cloud Messaging token.
   * Null si web/desktop sans PWA.
   * Mis à jour à chaque login depuis cet équipement.
   */
  @Column({ nullable: true, name: 'fcm_token', type: 'text' })
  fcmToken?: string;

  /** Dernière activité sur cet équipement */
  @Column({ nullable: true, name: 'last_active_at', type: 'datetime' })
  lastActiveAt?: Date;
}
