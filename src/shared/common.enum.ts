// ============================================================
// UNIFIED AUTH — common.enum.ts
// ============================================================

export enum UserRole {
  user = 'user',
  manager = 'manager',
  admin = 'admin',
  engineer = 'engineer',
  /**
   * Marqueur plateforme grossier — « ce compte appartient au clergé/personnel ».
   * Ne porte AUCUN détail de fonction ni d'affectation par église : ça vit dans
   * `ClergyMember.role` (`EcclesialRole`) + `ClergyMember.churchId`, voir
   * AMISACHE.md §5. `clergy` sert uniquement l'accès plateforme grossier
   * (ex: client API `manager`, UI dédiée), jamais une autorisation par église.
   */
  clergy = 'clergy',
}

export enum UserStatus {
  active = 'active',
  unverified = 'unverified',
  disabled = 'disabled',
  blocked = 'blocked',
  deleted = 'deleted',
}

export enum ApiClientType {
  // Mobile
  mobile = 'mobile',
  ios = 'ios',
  manager = 'manager',
  // Web
  web = 'web',
  web_app = 'web_app',
  website = 'website',
  landing = 'landing',
  // Commun
  back_office = 'back_office',
  swagger = 'swagger',
}

export enum TokenType {
  access = 'access',
  refresh = 'refresh',
}

export enum DeviceType {
  mobile = 'mobile',
  desktop = 'desktop',
  tablet = 'tablet',
  unknown = 'unknown',
}

export enum AbilityEnum {
  create = 'create',
  edit = 'edit',
  view = 'view',
  owner = 'owner',
  list = 'list',
  delete = 'delete',
}

export enum FileStatus {
  using = 'using',
  deleted = 'deleted',
  unused = 'unused',
}

export enum ContactMessageStatus {
  new = 'new',
  read = 'read',
  treated = 'treated',
}

/**
 * Regroupement des FAQ. Placeholder générique — à adapter (valeurs, libellés)
 * selon le domaine métier de chaque projet dérivé.
 */
export enum FaqCategory {
  general = 'general',
  account = 'account',
  billing = 'billing',
  security = 'security',
  technical = 'technical',
}

/**
 * Type de la valeur stockée dans Setting.value (toujours en `text` en base).
 * Sert au (dé)sérialisation côté service — voir SettingService.parseValue.
 */
export enum SettingType {
  string = 'string',
  number = 'number',
  boolean = 'boolean',
  json = 'json',
}

// ── Chat ──────────────────────────────────────────────────────
// Voir chat-model.mermaid et prompt-claude-code-chat.md pour le modèle
// de référence. SYSTEM/CALL sont conservés dans les enums (coût nul,
// extensible) mais ne sont émis par aucun code de ce lot.

export enum ConversationStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum ConversationMode {
  BOT = 'BOT',
  AGENT = 'AGENT',
}

/** Décide comment résoudre actorId/senderId — voir note polymorphisme du prompt chat */
export enum ActorType {
  HUMAN = 'HUMAN',
  AI = 'AI',
  SYSTEM = 'SYSTEM',
}

export enum ParticipantRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
  ASSIGNED_AGENT = 'ASSIGNED_AGENT',
  CLIENT = 'CLIENT',
  DRIVER = 'DRIVER',
}

export enum MessageKind {
  TEXT = 'TEXT',
  MEDIA = 'MEDIA',
  CALL = 'CALL',
  SYSTEM = 'SYSTEM',
}

export enum AttachmentKind {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}
