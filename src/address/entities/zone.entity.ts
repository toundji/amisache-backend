// ============================================================
// AMISACHE — zone.entity.ts
// Deuxième niveau modélisé, sous Region. C'est l'ancrage OBLIGATOIRE
// de toute Address — voir CLAUDE.md §4.1 (Village non exhaustif).
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
import { Region } from './region.entity';

@Entity('zones')
export class Zone extends Audit {
  static entityName = 'zones';
  static entityCode = '23';

  @Column()
  name!: string;

  /**
   * Libellé du niveau administratif réel sauté entre Region et Zone,
   * s'il existe (déduit de `Country.allSub`). Null si aucun niveau sauté.
   */
  @Column({ nullable: true, name: 'parent_sub' })
  parentSub?: string;

  // ─── Relation : Region ──────────────────────────────────────
  // ⚠️ regionId est en LECTURE SEULE — modifier via region: { id } as any

  @Index()
  @Column({ name: 'region_id' })
  regionId!: string;

  @ManyToOne(() => Region, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id', referencedColumnName: 'id' })
  region?: Region;

  /** Code lisible généré à l'insertion (ex: 23-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Zone.entityCode + Date.now();
  }
}
