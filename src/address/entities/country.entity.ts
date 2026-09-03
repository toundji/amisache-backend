// ============================================================
// AMISACHE — country.entity.ts
// Racine du module Adresse — un pays par entrée, configure le
// découpage administratif réel (`allSub`) et les niveaux modélisés
// affichés à l'écran (`subdivisions`). Voir CLAUDE.md §4.1.
// ============================================================
import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { Audit } from '../../shared/audit';

@Entity('countries')
export class Country extends Audit {
  static entityName = 'countries';
  static entityCode = '21';

  /** ISO 3166-1 alpha-2, ex. "BJ" */
  @Index({ unique: true })
  @Column({ name: 'iso_code', length: 2 })
  isoCode!: string;

  /** Indicatif téléphonique, ex. "+229" */
  @Column({ name: 'calling_code', length: 8 })
  callingCode!: string;

  /**
   * Libellés d'affichage des niveaux MODÉLISÉS (Region → Zone → Village),
   * dans cet ordre. Ex. ["Département", "Commune", "Village/Quartier"].
   */
  @Column({ type: 'json' })
  subdivisions!: string[];

  /**
   * Hiérarchie administrative réelle COMPLÈTE du pays, niveaux sautés
   * inclus. Sert à déduire le libellé stocké dans `parentSub` du niveau
   * modélisé immédiatement en dessous. Voir cahier-des-charges §4.1.
   */
  @Column({ type: 'json', name: 'all_sub' })
  allSub!: string[];

  /** Code lisible généré à l'insertion (ex: 21-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.isoCode = this.isoCode?.trim()?.toUpperCase();
    this.code = Country.entityCode + Date.now();
  }
}
