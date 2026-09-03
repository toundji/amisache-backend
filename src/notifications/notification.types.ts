// ============================================================
// UNIFIED AUTH — notification.types.ts
// Contrat public du module notifications/. Module abstrait et
// réutilisable : aucune règle métier ici, chaque projet consommateur
// enregistre ses propres channels + son mapping type -> channel via
// NotificationModule.forRoot()/forRootAsync().
// ============================================================
import type { DynamicModule, Type } from '@nestjs/common';

/**
 * Payload d'une notification à émettre.
 * `dedupKey` est TOUJOURS fourni par l'appelant (métier) — déterministe,
 * dérivé de `scope + type + id_métier`, jamais random ni Date.now().
 * `userId` null = notification de groupe/broadcast.
 */
export interface NotifyPayload {
  userId?: string | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  dedupKey: string;
  expiresAt?: Date | null;
}

/**
 * Transport enfichable. `key` identifie le channel pour la résolution
 * type -> channel(s) (NotificationModuleOptions.channelsByType).
 * `supports()` permet à un channel de s'auto-exclure (ex. fcm-token ne
 * s'applique qu'aux notifications ciblées, fcm-topic qu'aux broadcasts).
 */
export interface NotificationChannel {
  readonly key: string;
  supports(payload: NotifyPayload): boolean;
  send(payload: NotifyPayload): Promise<void>;
}

/**
 * Port d'envoi FCM — le module ne connaît jamais firebase-admin.
 * Chaque projet fournit son implémentation (ex. un adaptateur autour du
 * NotificationService FCM déjà présent dans auth/) et l'injecte dans les
 * channels fcm-token/fcm-topic au moment du forRoot()/forRootAsync().
 */
export interface FcmSender {
  sendToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void>;
  sendToTopic(
    topic: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void>;
}

/** Émetteur temps réel — le channel websocket reste un stub tant que rien n'est branché. */
export interface WebSocketEmitter {
  emitToUser?(userId: string, event: string, payload: NotifyPayload): void;
  emitBroadcast?(event: string, payload: NotifyPayload): void;
}

export interface NotificationModuleOptions {
  /** Channels enregistrés par le projet consommateur (in-app, fcm-token, fcm-topic, websocket, ou custom). */
  channels: NotificationChannel[];
  /** Mapping type -> clés de channels à utiliser. Sans entrée pour un type, tous les channels dont supports() renvoie true sont utilisés. */
  channelsByType?: Record<string, string[]>;
  /** Rétention des notifications lues, en jours. Défaut : 30. */
  retentionDays?: number;
  /** Expression cron du job de purge. Défaut : '0 3 * * *'. */
  purgeCron?: string;
  /** Taille des lots de suppression (DELETE ... LIMIT n en boucle). Défaut : 500. */
  purgeBatchSize?: number;
}

export interface NotificationModuleAsyncOptions {
  imports?: Array<Type<unknown> | DynamicModule>;
  useFactory: (
    ...args: any[]
  ) => Promise<NotificationModuleOptions> | NotificationModuleOptions;
  inject?: any[];
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
export const NOTIFICATION_MODULE_OPTIONS = Symbol(
  'NOTIFICATION_MODULE_OPTIONS',
);
