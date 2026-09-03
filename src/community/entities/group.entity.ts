// ============================================================
// AMISACHE — group.entity.ts
// Groupe d'affinité rattaché à une église (chorale, mouvement,
// association...). Voir cahier-des-charges §4.9.
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
import { Church } from '../../church/entities/church.entity';
import { GroupType } from '../community.enum';

@Entity('groups')
export class Group extends Audit {
  static entityName = 'groups';
  static entityCode = '36';

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: GroupType })
  type!: GroupType;

  // ─── Relation : Church ──────────────────────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  /** Code lisible généré à l'insertion (ex: 36-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Group.entityCode + Date.now();
  }
}
