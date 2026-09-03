// ============================================================
// AMISACHE — clergy-member.entity.ts
// Affectation personne ↔ entité, avec rôle et période (plusieurs-à-
// plusieurs) — symétrique de Membership (church/entities/membership.entity.ts,
// à venir avec l'extension de User). Voir AMISACHE.md §5, §7.6.
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
import { EcclesialRole } from '../church.enum';

@Entity('clergy_members')
export class ClergyMember extends Audit {
  static entityName = 'clergy_members';
  static entityCode = '27';

  @Column({ type: 'enum', enum: EcclesialRole })
  role!: EcclesialRole;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  /** Vide = affectation toujours active */
  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate?: string;

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

  /** Code lisible généré à l'insertion (ex: 27-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = ClergyMember.entityCode + Date.now();
  }
}
