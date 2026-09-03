// ============================================================
// AMISACHE — type.enum.ts
// Voir diagramme-classe-paroisses.mermaid / cahier-des-charges §4.10.
// ============================================================

/**
 * Discrimine la table mutualisée `Type`. Chaque entité métier ne
 * référence que des `Type` de son propre scope (règle applicative,
 * pas une contrainte de schéma).
 */
export enum TypeScope {
  INTENTION = 'INTENTION',
  SACRAMENT = 'SACRAMENT',
  DONATION = 'DONATION',
  PUBLICATION = 'PUBLICATION',
  SCHEDULE = 'SCHEDULE',
}
