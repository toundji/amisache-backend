// ============================================================
// AMISACHE — church.enum.ts
// Voir diagramme-classe-paroisses.mermaid / cahier-des-charges §4.2–4.4.
// ============================================================

/**
 * Niveau de la hiérarchie ecclésiale, auto-référente dans une seule
 * table `Church`. Ordre décroissant : CONFERENCE est la racine ;
 * CHURCH/CHAPEL sont des feuilles (rattachées à PAROISSE ou COMMUNAUTE).
 */
export enum EntityType {
  CONFERENCE = 'CONFERENCE',
  ARCHDIOCESE = 'ARCHDIOCESE',
  DIOCESE = 'DIOCESE',
  VICARIAT = 'VICARIAT',
  PAROISSE = 'PAROISSE',
  COMMUNAUTE = 'COMMUNAUTE',
  CHURCH = 'CHURCH',
  CHAPEL = 'CHAPEL',
}

/**
 * Nature d'une entité : PHYSICAL = un lieu réel (archidiocèse, paroisse,
 * église, chapelle), VIRTUAL = un regroupement administratif (conférence,
 * diocèse, vicariat, communauté). Valeur par défaut déduite du type —
 * voir defaultNatureFor — mais modifiable entité par entité.
 */
export enum ChurchNature {
  PHYSICAL = 'PHYSICAL',
  VIRTUAL = 'VIRTUAL',
}

const PHYSICAL_TYPES = [
  EntityType.ARCHDIOCESE,
  EntityType.PAROISSE,
  EntityType.CHURCH,
  EntityType.CHAPEL,
];

export function defaultNatureFor(type: EntityType): ChurchNature {
  return PHYSICAL_TYPES.includes(type) ? ChurchNature.PHYSICAL : ChurchNature.VIRTUAL;
}

/** Encadre l'entrée d'une entité sur la plateforme (voir cahier-des-charges §4.3) */
export enum ValidationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
}

/** Fonction ecclésiale d'une affectation ClergyMember (voir cahier-des-charges §3) */
export enum EcclesialRole {
  ARCHBISHOP = 'ARCHBISHOP',
  BISHOP = 'BISHOP',
  PRIEST = 'PRIEST',
  VICAR = 'VICAR',
  DEACON = 'DEACON',
  CATECHIST = 'CATECHIST',
  SECRETARY = 'SECRETARY',
  ADMIN = 'ADMIN',
}

export enum EntranceType {
  VEHICLE = 'VEHICLE',
  PEDESTRIAN = 'PEDESTRIAN',
  MIXED = 'MIXED',
  SERVICE = 'SERVICE',
}
