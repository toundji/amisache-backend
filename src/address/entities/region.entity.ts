// ============================================================
// AMISACHE — region.entity.ts
// Premier niveau modélisé sous Country. Voir CLAUDE.md §4.1.
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
import { Country } from './country.entity';

@Entity('regions')
export class Region extends Audit {
  static entityName = 'regions';
  static entityCode = '22';

  @Column()
  name!: string;

  /**
   * Libellé du niveau administratif réel sauté entre Country et Region,
   * s'il existe (déduit de `Country.allSub`). Null si aucun niveau sauté.
   */
  @Column({ nullable: true, name: 'parent_sub' })
  parentSub?: string;

  // ─── Relation : Country ─────────────────────────────────────
  // ⚠️ countryId est en LECTURE SEULE — modifier via country: { id } as any

  @Index()
  @Column({ name: 'country_id' })
  countryId!: string;

  @ManyToOne(() => Country, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'country_id', referencedColumnName: 'id' })
  country?: Country;

  /** Code lisible généré à l'insertion (ex: 22-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Region.entityCode + Date.now();
  }
}
