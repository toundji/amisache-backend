// ============================================================
// AMISACHE — geo.ts
// Types géospatiaux GeoJSON minimaux (MySQL 8 spatial) + transformers
// TypeORM pour les colonnes 'point'/'polygon'.
//
// ⚠️ TypeORM (driver MySQL) n'échange PAS du GeoJSON avec les colonnes
// spatiales : en écriture il wrappe la valeur dans ST_GeomFromText(?, srid)
// — il faut donc lui fournir une chaîne WKT ("POINT(lng lat)"), jamais un
// objet ; en lecture il sélectionne via ST_AsText(colonne), qui renvoie
// cette même chaîne WKT brute, sans la reconvertir en objet. Sans les
// transformers ci-dessous, une écriture envoie un objet à ST_GeomFromText
// (WKT invalide → MySQL stocke NULL sans erreur) et une lecture renverrait
// une chaîne WKT brute au lieu du GeoJSON attendu par le reste du code.
// Voir EVOLUTION.md (entrée du fix) pour le détail du diagnostic.
// ============================================================
import type { ValueTransformer } from 'typeorm';

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

/** À poser sur toute colonne `{ type: 'point', ... }` (ex. Address.location). */
export const pointTransformer: ValueTransformer = {
  to: (value?: Point): string | undefined =>
    value ? `POINT(${value.coordinates[0]} ${value.coordinates[1]})` : undefined,
  from: (value?: string): Point | undefined => {
    if (!value) return undefined;
    const match = /^POINT\(([^ ]+) ([^)]+)\)$/.exec(value);
    if (!match) return undefined;
    return { type: 'Point', coordinates: [parseFloat(match[1]), parseFloat(match[2])] };
  },
};

/** À poser sur toute colonne `{ type: 'polygon', ... }` (ex. Church.perimeter). */
export const polygonTransformer: ValueTransformer = {
  to: (value?: Polygon): string | undefined => {
    if (!value) return undefined;
    const ring = value.coordinates[0].map(([lng, lat]) => `${lng} ${lat}`).join(', ');
    return `POLYGON((${ring}))`;
  },
  from: (value?: string): Polygon | undefined => {
    if (!value) return undefined;
    const match = /^POLYGON\(\((.+)\)\)$/.exec(value);
    if (!match) return undefined;
    const ring = match[1].split(',').map((pair) => {
      const [lng, lat] = pair.trim().split(' ').map(Number);
      return [lng, lat] as [number, number];
    });
    return { type: 'Polygon', coordinates: [ring] };
  },
};
