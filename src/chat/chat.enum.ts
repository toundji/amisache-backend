// ============================================================
// AMISACHE — chat.enum.ts
// Enums propres au métier Amisache pour chat/ (socle adapté, cf.
// AMISACHE.md §6.1) — vivent ici plutôt que dans shared/common.enum.ts
// pour respecter la règle CLAUDE.md « enums métier dans leur module,
// shared/ reste neutre » : un autre projet dérivé du même template n'a
// aucune raison d'hériter de rôles nommés pour une messagerie
// fidèle/clergé.
// ============================================================

/**
 * Rôle d'un Participant dans une Conversation. Remplace le
 * DRIVER/CLIENT/ASSIGNED_AGENT du template générique — OWNER/MEMBER
 * restent (rôles génériques, pas propres à un métier).
 */
export enum ParticipantRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
  /** Le fidèle (ou visiteur) qui pose une question. */
  FAITHFUL = 'FAITHFUL',
  /** Un membre du clergé/personnel qui répond au nom d'une paroisse. */
  CLERGY = 'CLERGY',
}
