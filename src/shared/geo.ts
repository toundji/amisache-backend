// ============================================================
// AMISACHE — geo.ts
// Types géospatiaux GeoJSON minimaux (MySQL 8 spatial).
// TypeORM ne fournit pas de type Point/Polygon typé : ses colonnes
// spatiales ('point', 'polygon') échangent des objets GeoJSON bruts
// avec le driver mysql2. Ces interfaces couvrent juste ce qui est
// manipulé côté application — pas une lib GeoJSON complète.
// ============================================================

/** coordinates: [longitude, latitude] — ordre GeoJSON, PAS [lat, lng] */
export interface Point {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Polygon simple (pas de trous) : un seul ring de coordonnées.
 * Le ring doit être fermé (dernier point = premier) — règle métier,
 * pas imposée par le type ici.
 */
export interface Polygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}
