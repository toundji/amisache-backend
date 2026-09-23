// ============================================================
// AMISACHE — chat.gateway.ts
// Temps réel du chat (Socket.io) — namespace /chat. Vient EN PLUS des
// routes HTTP existantes (ChatController/ChatGuestController), ne les
// remplace pas : l'écriture (envoi de message, lecture, handoff...)
// reste exclusivement HTTP ; ce gateway ne fait qu'authentifier la
// connexion, gérer les rooms par conversation et diffuser les
// événements émis par ChatService via ChatRealtimeService après
// chaque écriture (voir chat.service.ts).
//
// Auth double, comme le reste de chat/ (cf. AMISACHE.md §6.1) :
// - HUMAN authentifié : JWT vérifié par WebSocketAuthMiddleware
//   (scaffolding du socle, jusqu'ici jamais câblé — voir
//   core/middleware/api-middleware.ts), + vérification blacklist jti
//   Redis (même contrôle que RequireAuthGuard côté HTTP, absent du
//   middleware WS d'origine).
// - GUEST anonyme (bulle publique) : `guestId` (UUID) transmis dans
//   `handshake.auth.guestId`, jamais un JWT — même modèle de confiance
//   que ChatGuestController (aucune signature, l'appartenance à une
//   conversation est vérifiée à chaque `join_conversation` via
//   ChatService.isActiveParticipant, jamais supposée).
// - Clé API obligatoire dans les deux cas (même garde-fou que
//   ApiKeyGuard côté HTTP — défense en profondeur, pas de connexion
//   socket depuis un client non reconnu).
// ============================================================
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Namespace, Socket } from 'socket.io';
import { isUUID } from 'class-validator';

import { WebSocketAuthMiddleware } from '../../core/middleware/api-middleware';
import { getApiClientType } from '../../utils/api-util';
import { redisKeys } from '../../utils/redis.config';
import { ActorType, UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { ChatService } from '../services/chat.service';
import {
  CHAT_ADMIN_ROOM,
  ChatRealtimeService,
  conversationRoom,
} from '../services/chat-realtime.service';
import { JoinConversationDto, TypingDto } from '../dto/socket.dto';

interface ChatSocketData {
  actorId: string;
  actorType: ActorType;
  isAdmin: boolean;
  /** Rooms de conversation rejointes — pour nettoyer la présence au disconnect. */
  conversations: Set<string>;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // Namespace, pas Server — voir la note de ChatRealtimeService (server.of(namespace)).
  @WebSocketServer() private readonly server!: Namespace;

  private readonly logger = new Logger(ChatGateway.name);

  /** conversationId -> "ACTORTYPE:actorId" -> socket ids connectés dessus. */
  private readonly presence = new Map<string, Map<string, Set<string>>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly realtime: ChatRealtimeService,
    private readonly wsAuthMiddleware: WebSocketAuthMiddleware,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  afterInit(server: Namespace): void {
    this.realtime.setServer(server);
    server.use((socket, next) => this.wsAuthMiddleware.use(socket, next));
  }

  // ── Connexion — authentification + rooms automatiques ────────

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const apiKey = this.extractApiKey(socket);
      if (!apiKey || !getApiClientType(apiKey)) {
        return this.reject(socket, 'WS_API_KEY_INVALID', 'Clé API invalide.');
      }

      const handshake = socket.handshake as typeof socket.handshake & {
        user?: JwtUserInfo;
        accessToken?: string;
      };
      const jwtUser = handshake.user;
      const tokenWasProvided = !!handshake.accessToken;

      if (tokenWasProvided && !jwtUser) {
        return this.reject(
          socket,
          'WS_TOKEN_INVALID',
          'Session invalide ou expirée.',
        );
      }

      if (jwtUser) {
        if (jwtUser.jti) {
          const blacklisted = await this.redis.get(redisKeys.jti(jwtUser.jti));
          if (blacklisted) {
            return this.reject(
              socket,
              'WS_TOKEN_REVOKED',
              'Session révoquée.',
            );
          }
        }

        const isAdmin = (jwtUser.roles ?? []).some(
          (role) => role === UserRole.admin || role === UserRole.engineer,
        );

        this.setSocketData(socket, {
          actorId: jwtUser.id,
          actorType: ActorType.HUMAN,
          isAdmin,
          conversations: new Set(),
        });

        if (isAdmin) await socket.join(CHAT_ADMIN_ROOM);
        this.logger.debug(`handleConnection OK — HUMAN:${jwtUser.id} (admin=${isAdmin})`);
        return;
      }

      const guestId = socket.handshake.auth?.guestId;
      if (typeof guestId === 'string' && isUUID(guestId)) {
        this.setSocketData(socket, {
          actorId: guestId,
          actorType: ActorType.GUEST,
          isAdmin: false,
          conversations: new Set(),
        });
        this.logger.debug(`handleConnection OK — GUEST:${guestId}`);
        return;
      }

      return this.reject(socket, 'WS_AUTH_REQUIRED', 'Authentification requise.');
    } catch (error) {
      this.logger.error('handleConnection failed', error as Error);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const data = this.getSocketData(socket);
    if (!data) return;

    for (const conversationId of data.conversations) {
      this.untrackPresence(conversationId, socket);
      this.broadcastPresence(conversationId);
    }
  }

  // ── Rooms par conversation ─────────────────────────────────

  @SubscribeMessage('join_conversation')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: JoinConversationDto,
  ): Promise<void> {
    try {
      const data = this.getSocketData(socket);
      if (!data) return;

      if (!data.isAdmin) {
        const allowed = await this.chatService.isActiveParticipant(
          dto.conversationId,
          data.actorId,
        );
        if (!allowed) {
          this.logger.warn(
            `join_conversation refusé — ${data.actorType}:${data.actorId} n'est pas participant actif de ${dto.conversationId}`,
          );
          socket.emit('error', {
            code: 'WS_FORBIDDEN',
            message: "Vous n'êtes pas participant de cette conversation.",
          });
          return;
        }
      }

      await socket.join(conversationRoom(dto.conversationId));
      data.conversations.add(dto.conversationId);
      this.trackPresence(dto.conversationId, socket);
      this.broadcastPresence(dto.conversationId);
      this.logger.debug(
        `join_conversation OK — ${data.actorType}:${data.actorId} a rejoint ${conversationRoom(dto.conversationId)}`,
      );
    } catch (error) {
      this.logger.error('onJoinConversation a planté', error as Error);
    }
  }

  @SubscribeMessage('leave_conversation')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  onLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: JoinConversationDto,
  ): void {
    const data = this.getSocketData(socket);
    socket.leave(conversationRoom(dto.conversationId));
    data?.conversations.delete(dto.conversationId);
    this.untrackPresence(dto.conversationId, socket);
    this.broadcastPresence(dto.conversationId);
  }

  // ── Indicateur de frappe (éphémère, pas de DB) ────────────────

  @SubscribeMessage('typing')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: TypingDto,
  ): void {
    const data = this.getSocketData(socket);
    if (!data?.conversations.has(dto.conversationId)) return;

    socket.to(conversationRoom(dto.conversationId)).emit('typing', {
      conversationId: dto.conversationId,
      actorId: data.actorId,
      actorType: data.actorType,
      isTyping: dto.isTyping,
    });
  }

  // ── Présence (en mémoire — instance unique, cf. décision projet) ──

  private trackPresence(conversationId: string, socket: Socket): void {
    const key = this.actorKey(socket);
    if (!key) return;

    let room = this.presence.get(conversationId);
    if (!room) {
      room = new Map();
      this.presence.set(conversationId, room);
    }
    let sockets = room.get(key);
    if (!sockets) {
      sockets = new Set();
      room.set(key, sockets);
    }
    sockets.add(socket.id);
  }

  private untrackPresence(conversationId: string, socket: Socket): void {
    const key = this.actorKey(socket);
    const room = this.presence.get(conversationId);
    if (!key || !room) return;

    const sockets = room.get(key);
    sockets?.delete(socket.id);
    if (sockets && sockets.size === 0) room.delete(key);
    if (room.size === 0) this.presence.delete(conversationId);
  }

  private broadcastPresence(conversationId: string): void {
    const room = this.presence.get(conversationId);
    const online = room
      ? Array.from(room.keys()).map((key) => {
          const [actorType, actorId] = key.split(':');
          return { actorType, actorId };
        })
      : [];

    this.realtime.emitToConversation(conversationId, 'presence:update', {
      conversationId,
      online,
    });
  }

  private actorKey(socket: Socket): string | undefined {
    const data = this.getSocketData(socket);
    return data ? `${data.actorType}:${data.actorId}` : undefined;
  }

  // ── Helpers ────────────────────────────────────────────────

  private setSocketData(socket: Socket, data: ChatSocketData): void {
    (socket.data as ChatSocketData) = data;
  }

  private getSocketData(socket: Socket): ChatSocketData | undefined {
    return socket.data as ChatSocketData | undefined;
  }

  private extractApiKey(socket: Socket): string | undefined {
    const fromAuth = socket.handshake.auth?.apiKey;
    if (typeof fromAuth === 'string' && fromAuth) return fromAuth;

    const headerName = (process.env.API_KEY_HEADER_NAME ?? 'api-key').toLowerCase();
    const fromHeader = socket.handshake.headers[headerName];
    return typeof fromHeader === 'string' ? fromHeader : undefined;
  }

  private reject(socket: Socket, code: string, message: string): void {
    socket.emit('error', { code, message });
    socket.disconnect(true);
  }
}
