// ============================================================
// AMISACHE — address.embeddable.ts
// Objet-valeur EMBARQUÉ (pas une entité, pas de table dédiée) —
// composition 1--1 dans l'entité hôte (ex: Church.address).
// Voir AMISACHE.md §4 « Address — value object embarqué ».
//
// ⚠️ Un embedded TypeORM ne porte pas de relation @ManyToOne : zoneId
// et villageId restent de simples colonnes uuid. Si l'entité hôte a
// besoin de naviguer vers Zone/Village, elle déclare ses propres
// relations à côté de son `@Column(() => Address)`.
//
// Pas de préfixe sur ces colonnes (`{ prefix: false }` sur le
// `@Column(() => Address)` de l'entité hôte) : Church n'a qu'un seul
// objet-valeur embarqué, aucun risque de collision de nom.
// ============================================================
import { Column } from 'typeorm';
import type { Point } from '../../shared/geo';

export class Address {
  /** Précision locale libre (quartier, rue non normalisée...) */
  @Column({ nullable: true })
  locality?: string;

  /** Repère d'orientation — l'adressage local se fait par repère, pas par numéro de rue */
  @Column({ nullable: true })
  landmark?: string;

  /** Position GPS — utilisée pour la recherche de proximité (ST_Distance) */
  @Column({
    type: 'point',
    nullable: true,
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location?: Point;

  /** Ancrage obligatoire — toute Address référence au minimum sa Zone */
  @Column({ name: 'zone_id' })
  zoneId!: string;

  /** Village non exhaustif — référencé seulement s'il est connu */
  @Column({ nullable: true, name: 'village_id' })
  villageId?: string;
}
