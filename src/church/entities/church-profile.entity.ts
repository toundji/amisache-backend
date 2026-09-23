// ============================================================
// AMISACHE — church-profile.entity.ts
// Contenu de présentation d'une église (description éditoriale — histoire,
// patron, ce qui la distingue) — table séparée de `Church`, délibérément :
// `Church` est jointe dans quasiment toutes les relations métier (liturgy/,
// payment/, community/...), un champ éditorial volumineux et rarement lu
// n'a rien à y faire. Relation 1—1, un profil par église, optionnel.
// ============================================================
import { Entity, Column, Index, OneToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { Audit } from '../../shared/audit';
import { Church } from './church.entity';

@Entity('church_profiles')
export class ChurchProfile extends Audit {
  static entityName = 'church_profiles';
  static entityCode = '40';

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true, name: 'leader_message' })
  leaderMessage?: string;

  // ─── Relation : Church (1—1) ─────────────────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any
  // onDelete CASCADE : le profil n'a aucun sens sans l'église qui le porte
  // (à l'inverse de Church.parentId, en RESTRICT pour protéger la hiérarchie).

  @Index({ unique: true })
  @Column({ name: 'church_id' })
  churchId!: string;

  @OneToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  /** Code lisible généré à l'insertion (ex: 40-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = ChurchProfile.entityCode + Date.now();
  }
}
