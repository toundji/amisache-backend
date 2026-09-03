// ============================================================
// AMISACHE — community.enum.ts
// Voir diagramme-classe-paroisses.mermaid / cahier-des-charges §4.8–4.9.
// ============================================================

export enum PublicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum MediaKind {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
}

export enum MediaProvider {
  YOUTUBE = 'YOUTUBE',
  UPLOAD = 'UPLOAD',
  FACEBOOK = 'FACEBOOK',
  OTHER = 'OTHER',
}

export enum GroupType {
  CHOIR = 'CHOIR',
  MOVEMENT = 'MOVEMENT',
  ASSOCIATION = 'ASSOCIATION',
  OTHER = 'OTHER',
}
