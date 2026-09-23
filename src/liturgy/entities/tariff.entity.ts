// ============================================================
// AMISACHE — tariff.entity.ts
// Tarif d'une intention/d'un sacrement, publié par une église — voir
// EVOLUTION.md (session du 2026-09-15, « tarification »). Résolution avec
// repli hiérarchique : si une église (chapelle/communauté/paroisse...) n'a
// pas défini son propre tarif pour un Type donné, on remonte via
// `Church.parentId` jusqu'à en trouver un — voir TariffService.resolve.
//
// Un seul tarif actif par (church, type) — index unique.
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
import { Type } from '../../type/entities/type.entity';

@Entity('tariffs')
@Index(['churchId', 'typeId'], { unique: true })
export class Tariff extends Audit {
  static entityName = 'tariffs';
  static entityCode = '39';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  /** Désactivé = ignoré par la résolution (comme s'il n'existait pas). */
  @Column({ default: true })
  active!: boolean;

  // ─── Relation : Church (église qui publie ce tarif) ─────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  // ─── Relation : Type (intention ou sacrement tarifé) ────────
  // ⚠️ typeId est en LECTURE SEULE — modifier via type: { id } as any

  @Index()
  @Column({ name: 'type_id' })
  typeId!: string;

  @ManyToOne(() => Type, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'type_id', referencedColumnName: 'id' })
  type?: Type;

  /** Code lisible généré à l'insertion (ex: 39-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = Tariff.entityCode + Date.now();
  }
}
