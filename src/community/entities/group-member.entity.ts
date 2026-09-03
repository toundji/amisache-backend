// ============================================================
// AMISACHE — group-member.entity.ts
// Adhésion des fidèles à un groupe (plusieurs-à-plusieurs). Voir
// cahier-des-charges §4.9.
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
import { Group } from './group.entity';
import { User } from '../../users/entities/user.entity';

@Entity('group_members')
@Index(['userId', 'groupId'], { unique: true })
export class GroupMember extends Audit {
  static entityName = 'group_members';
  static entityCode = '37';

  // ─── Relation : Group ───────────────────────────────────────
  // ⚠️ groupId est en LECTURE SEULE — modifier via group: { id } as any

  @Index()
  @Column({ name: 'group_id' })
  groupId!: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id', referencedColumnName: 'id' })
  group?: Group;

  // ─── Relation : User ────────────────────────────────────────
  // ⚠️ userId est en LECTURE SEULE — modifier via user: { id } as any

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  /** Code lisible généré à l'insertion (ex: 37-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = GroupMember.entityCode + Date.now();
  }
}
