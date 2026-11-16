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

  /** Site web propre à l'église (certaines en ont déjà un) — lien affiché sur sa fiche publique. */
  @Column({ nullable: true, length: 500 })
  website?: string;

  // Réseaux de l'église (liens complets, facultatifs) — boutons sur sa fiche publique.
  // WhatsApp : lien wa.me ou de groupe/chaîne ; Telegram : lien t.me.

  @Column({ nullable: true, length: 500 })
  youtube?: string;

  @Column({ nullable: true, length: 500 })
  facebook?: string;

  @Column({ nullable: true, length: 500 })
  whatsapp?: string;

  @Column({ nullable: true, length: 500 })
  telegram?: string;

  // Direct déclaré par le clergé (« Je diffuse en direct ») : l'église est « En direct » tant que
  // liveUntil est dans le futur. liveUrl : lien du direct ; sinon les clients utilisent <chaîne YouTube>/live.

  @Column({ type: 'datetime', nullable: true, name: 'live_until' })
  liveUntil?: Date | null;

  @Column({ nullable: true, length: 500, name: 'live_url' })
  liveUrl?: string | null;

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
