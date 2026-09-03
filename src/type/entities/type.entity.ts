// ============================================================
// AMISACHE — type.entity.ts
// Table de types mutualisée : centralise toutes les listes évolutives
// (intentions, sacrements, dons, publications, horaires), discriminées
// par `scope`. Ajouter une valeur = une ligne, jamais un redéploiement.
// Voir cahier-des-charges-amisache.md §4.10.
// ============================================================
import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { Audit } from '../../shared/audit';
import { TypeScope } from '../type.enum';

@Entity('types')
@Index(['scope', 'name'], { unique: true })
export class Type extends Audit {
  static entityName = 'types';
  static entityCode = '20';

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: TypeScope })
  scope!: TypeScope;

  /** Un type désactivé reste référencé par l'historique mais disparaît des listes actives */
  @Column({ default: true })
  active!: boolean;

  /** Code lisible généré à l'insertion (ex: 20-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Type.entityCode + Date.now();
  }
}
