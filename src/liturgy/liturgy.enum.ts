// ============================================================
// AMISACHE — liturgy.enum.ts
// Voir diagramme-classe-paroisses.mermaid / cahier-des-charges §4.5–4.6.
// ============================================================

export enum ScheduleFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  ONCE = 'ONCE',
}

/** Gère les horaires temporaires (Avent, Carême, fête patronale...) */
export enum LiturgicalSeason {
  ORDINARY = 'ORDINARY',
  LENT = 'LENT',
  ADVENT = 'ADVENT',
  PATRON_FEAST = 'PATRON_FEAST',
}

export enum RequestStatus {
  SUBMITTED = 'SUBMITTED',
  IN_PROGRESS = 'IN_PROGRESS',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}
