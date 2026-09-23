// ============================================================
// AMISACHE — chat-realtime.service.ts
// Pont entre ChatService (écriture DB) et ChatGateway (Socket.io) —
// évite une dépendance circulaire ChatService <-> ChatGateway : le
// gateway pose le `Server` ici au démarrage (afterInit), ChatService
// n'importe jamais rien de socket.io directement.
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { Namespace } from 'socket.io';

/** Room admin/engineer — mêmes comptes que GET /chat/conversations/admin. */
export const CHAT_ADMIN_ROOM = 'admin:chat';

export const conversationRoom = (conversationId: string): string =>
  `conversation:${conversationId}`;

@Injectable()
export class ChatRealtimeService {
  private readonly logger = new Logger(ChatRealtimeService.name);
  // Typé `Namespace`, pas `Server` : pour un gateway avec `namespace: '/chat'`,
  // NestJS (`IoAdapter.createIOServer` → `server.of(namespace)`) injecte la
  // Namespace elle-même comme `@WebSocketServer()`/argument d'`afterInit`,
  // jamais le Server racine. `Namespace.adapter` est directement l'instance
  // Adapter ; `Server.adapter` est une toute autre méthode (configuration du
  // CONSTRUCTEUR d'adapter) — les deux types ne sont PAS interchangeables
  // malgré une API `.to()`/`.emit()` en apparence similaire.
  private server?: Namespace;

  setServer(server: Namespace): void {
    this.server = server;
    this.logger.debug('Server Socket.io posé (afterInit du ChatGateway).');
  }

  emitToConversation(conversationId: string, event: string, payload: unknown): void {
    this.emitToRoom(conversationRoom(conversationId), event, payload);
  }

  emitToAdmins(event: string, payload: unknown): void {
    this.emitToRoom(CHAT_ADMIN_ROOM, event, payload);
  }

  /**
   * Diffusion best-effort — ne doit JAMAIS faire échouer l'appelant (toujours
   * exécutée après l'écriture DB, qui a déjà réussi à ce stade). `server` est
   * en réalité un `Namespace` (`@WebSocketGateway({ namespace: '/chat' })`),
   * pas le `Server` racine : `.adapter` est directement dessus, PAS sous
   * `.sockets.adapter` (piège déjà rencontré — a fait planter `sendMessage`
   * en production le temps d'un diagnostic).
   */
  private emitToRoom(room: string, event: string, payload: unknown): void {
    try {
      if (!this.server) {
        this.logger.warn(`emit '${event}' ignoré — server Socket.io absent (afterInit jamais appelé ?)`);
        return;
      }
      const size = this.server.adapter.rooms.get(room)?.size ?? 0;
      this.logger.debug(`emit '${event}' -> room '${room}' (${size} socket(s))`);
      this.server.to(room).emit(event, payload);
    } catch (error) {
      this.logger.error(`emit '${event}' -> room '${room}' a échoué`, error as Error);
    }
  }
}
