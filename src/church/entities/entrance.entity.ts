// ============================================================
// AMISACHE — entrance.entity.ts
// Porte d'accès géolocalisée d'une Church (0..*). Voir AMISACHE.md §1.
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
import { EntranceType } from '../church.enum';
import type { Point } from '../../shared/geo';

@Entity('entrances')
export class Entrance extends Audit {
  static entityName = 'entrances';
  static entityCode = '26';

  @Column({ type: 'enum', enum: EntranceType })
  type!: EntranceType;

  @Column()
  name!: string;

  @Column({ type: 'point', spatialFeatureType: 'Point', srid: 4326 })
  location!: Point;

  // ─── Relation : Church ──────────────────────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  /** Code lisible généré à l'insertion (ex: 26-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Entrance.entityCode + Date.now();
  }
}
