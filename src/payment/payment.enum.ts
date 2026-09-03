// ============================================================
// AMISACHE — payment.enum.ts
// Voir diagramme-classe-paroisses.mermaid / cahier-des-charges §4.7.
// ============================================================

export enum PaymentOperator {
  MTN_MOMO = 'MTN_MOMO',
  MOOV_MONEY = 'MOOV_MONEY',
  BANK_CARD = 'BANK_CARD',
}

/**
 * Flux déclaratif à validation manuelle (pas d'intégration API au
 * démarrage) — voir cahier-des-charges §4.7 :
 *   SUBMITTED  → le fidèle a payé de son côté et joint son reçu
 *   CONFIRMED  → un ClergyMember de LA paroisse concernée a validé
 *   REJECTED   → un ClergyMember de LA paroisse concernée a rejeté
 */
export enum PaymentStatus {
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}
