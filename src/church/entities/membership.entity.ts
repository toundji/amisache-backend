// ============================================================
// AMISACHE — membership.entity.ts
// Jointure User ⇄ Church du FIDÈLE (paroisses suivies, sans rôle) —
// symétrique de ClergyMember (clergy-member.entity.ts). Voir
// AMISACHE.md §5 « Rattachement paroissial du fidèle ».
//
// Invariante `User.homeChurchId ∈ Membership(user)` : validée par
// MembershipService.setHomeChurch, jamais ici ni dans users/.
// ============================================================
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Audit } from '../../shared/audit';
import { Church } from './church.entity';
import { User } from '../../users/entities/user.entity';

@Entity('memberships')
@Index(['userId', 'churchId'], { unique: true })
export class Membership extends Audit {
  static entityName = 'memberships';
  static entityCode = '28';

  @Column({ type: 'date' })
  since!: string;

  // ─── Relation : Church ──────────────────────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  // ─── Relation : User ────────────────────────────────────────
  // ⚠️ userId est en LECTURE SEULE — modifier via user: { id } as any

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  /** Code lisible généré à l'insertion (ex: 28-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = Membership.entityCode + Date.now();
    this.since ??= new Date().toISOString().slice(0, 10);
  }
}
