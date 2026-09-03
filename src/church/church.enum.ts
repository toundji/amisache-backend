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
  DOYENNE = 'DOYENNE',
  PAROISSE = 'PAROISSE',
  COMMUNAUTE = 'COMMUNAUTE',
  CHURCH = 'CHURCH',
  CHAPEL = 'CHAPEL',
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
