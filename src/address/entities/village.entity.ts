// ============================================================
// AMISACHE — village.entity.ts
// Troisième niveau modélisé, sous Zone. NON EXHAUSTIF : une Address
// s'ancre toujours sur sa Zone et référence le Village seulement s'il
// est connu. Voir CLAUDE.md §4.1.
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
import { Zone } from './zone.entity';
import { VillageType } from '../address.enum';

@Entity('villages')
export class Village extends Audit {
  static entityName = 'villages';
  static entityCode = '24';

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: VillageType })
  type!: VillageType;

  /**
   * Libellé du niveau administratif réel sauté entre Zone et Village,
   * s'il existe (déduit de `Country.allSub`). Null si aucun niveau sauté.
   */
  @Column({ nullable: true, name: 'parent_sub' })
  parentSub?: string;

  // ─── Relation : Zone ────────────────────────────────────────
  // ⚠️ zoneId est en LECTURE SEULE — modifier via zone: { id } as any

  @Index()
  @Column({ name: 'zone_id' })
  zoneId!: string;

  @ManyToOne(() => Zone, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'zone_id', referencedColumnName: 'id' })
  zone?: Zone;

  /** Code lisible généré à l'insertion (ex: 24-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Village.entityCode + Date.now();
  }
}
