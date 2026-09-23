// ============================================================
// UNIFIED AUTH — chat.service.ts
// Cas d'usage couverts (voir prompt-claude-code-chat.md § Requêtes) :
// mes conversations, compteur de non-lus, ouverture de fil par sujet,
// envoi de message (+ cache liste), marquage lu, handoff BOT->AGENT.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { FileSystemStoredFile } from 'nestjs-form-data';

import { Conversation } from '../entities/conversation.entity';
import { Participant } from '../entities/participant.entity';
import { Message } from '../entities/message.entity';
import { Attachment } from '../entities/attachment.entity';
import { ActorType, AttachmentKind, ConversationMode } from '../../shared/common.enum';
import { ParticipantRole } from '../chat.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { ApiFsUtils } from '../../utils/api-fs';
import { UserService } from '../../users/services/user.service';
import {
  CreateConversationDto,
  ListConversationsQuery,
  PaginatedConversations,
} from '../dto/conversation.dto';
import {
  ListMessagesQuery,
  PaginatedMessages,
  SendMessageDto,
  SendMessageWithFilesDto,
} from '../dto/message.dto';
import { HandoffDto } from '../dto/handoff.dto';
import { ChatBotService, CHAT_BOT_GREETING } from './chat-bot.service';
import { ChatRealtimeService } from './chat-realtime.service';

const PREVIEW_MAX_LENGTH = 140;

/** Sujet conventionnel des conversations ouvertes par la bulle publique (visiteurs anonymes). */
const GUEST_SUBJECT_TYPE = 'guest-widget';

export interface Actor {
  actorId: string;
  actorType: ActorType;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepo: Repository<Participant>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly chatBotService: ChatBotService,
    private readonly realtime: ChatRealtimeService,
  ) { }

  /** Résumé léger d'une conversation — payload des événements temps réel de liste. */
  private toRealtimeSummary(conversation: Pick<
    Conversation,
    'id' | 'status' | 'mode' | 'lastMessageAt' | 'lastMessagePreview' | 'lastMessageSenderId'
  >) {
    return {
      id: conversation.id,
      status: conversation.status,
      mode: conversation.mode,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageSenderId: conversation.lastMessageSenderId,
    };
  }

  private async emitConversationUpdated(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) return;

    const payload = { conversation: this.toRealtimeSummary(conversation) };
    this.realtime.emitToConversation(conversationId, 'conversation:updated', payload);
    this.realtime.emitToAdmins('conversation:updated', payload);
  }

  // ── Validation acteur (voir note polymorphisme du prompt chat) ──

  private async validateActor(actor: Actor): Promise<void> {
    if (actor.actorType === ActorType.HUMAN) {
      await this.userService.getById(actor.actorId); // lève ApiErrorNotFoundById si absent
    }
  }

  // ── « Mes conversations » ─────────────────────────────────

  async myConversations(
    actorId: string,
    query: ListConversationsQuery,
  ): Promise<PaginatedConversations> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.conversationRepo
      .createQueryBuilder('c')
      .innerJoin(
        Participant,
        'p',
        'p.conversation_id = c.id AND p.actor_id = :actorId AND p.left_at IS NULL',
        { actorId },
      )
      .orderBy('c.lastMessageAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Toutes les conversations, admin/engineer uniquement — contrairement à
   * `myConversations`, ne filtre pas par participant. Nécessaire pour que le
   * panel voie les conversations ouvertes par la bulle publique (visiteur
   * anonyme, `ActorType.GUEST`) : aucun compte admin/clergé n'y est jamais
   * participant tant qu'un handoff n'a pas eu lieu, donc `myConversations`
   * n'en montre jamais aucune.
   */
  async listAdmin(query: ListConversationsQuery): Promise<PaginatedConversations> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const [data, total] = await this.conversationRepo.findAndCount({
      order: { lastMessageAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ── Compteur de non-lus ────────────────────────────────────

  async getUnreadCount(
    conversationId: string,
    actorId: string,
  ): Promise<number> {
    const participant = await this.getActiveParticipant(
      conversationId,
      actorId,
    );

    return this.messageRepo.count({
      where: {
        conversationId,
        senderId: Not(actorId),
        ...(participant.lastReadAt
          ? { createdAt: MoreThan(participant.lastReadAt) }
          : {}),
      },
    });
  }

  // ── Ouverture / réutilisation d'un fil ────────────────────

  async createOrOpen(
    initiator: Actor,
    dto: CreateConversationDto,
  ): Promise<Conversation> {
    await this.validateActor(initiator);

    if (dto.subjectType && dto.subjectId) {
      const existing = await this.conversationRepo.findOne({
        where: { subjectType: dto.subjectType, subjectId: dto.subjectId },
      });
      if (existing) {
        await this.ensureParticipant(
          existing.id,
          initiator,
          ParticipantRole.OWNER,
        );
        return existing;
      }
    }

    const conversation = await this.conversationRepo.save(
      this.conversationRepo.create({
        subjectType: dto.subjectType ?? undefined,
        subjectId: dto.subjectId ?? undefined,
        mode: dto.mode ?? ConversationMode.AGENT,
      }),
    );

    await this.participantRepo.save(
      this.participantRepo.create({
        conversationId: conversation.id,
        actorId: initiator.actorId,
        actorType: initiator.actorType,
        role: ParticipantRole.OWNER,
      }),
    );

    for (const p of dto.participants ?? []) {
      await this.validateActor({ actorId: p.actorId, actorType: p.actorType });
      await this.participantRepo.save(
        this.participantRepo.create({
          conversationId: conversation.id,
          actorId: p.actorId,
          actorType: p.actorType,
          role: p.role,
        }),
      );
    }

    this.realtime.emitToAdmins('conversation:updated', {
      conversation: this.toRealtimeSummary(conversation),
    });

    return conversation;
  }

  private async ensureParticipant(
    conversationId: string,
    actor: Actor,
    role: ParticipantRole,
  ): Promise<void> {
    const active = await this.participantRepo.findOne({
      where: { conversationId, actorId: actor.actorId, leftAt: IsNull() },
    });
    if (active) return;

    await this.participantRepo.save(
      this.participantRepo.create({
        conversationId,
        actorId: actor.actorId,
        actorType: actor.actorType,
        role,
      }),
    );
  }

  private async getActiveParticipant(
    conversationId: string,
    actorId: string,
  ): Promise<Participant> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, actorId, leftAt: IsNull() },
    });
    if (!participant) {
      throw new ApiErrorNotFoundById('chat_participants', actorId);
    }
    return participant;
  }

  /**
   * Variante booléenne de `getActiveParticipant`, pour l'autorisation de
   * rejoindre une room Socket.io (ChatGateway) — même critère
   * d'appartenance (participant actif), sans lever d'erreur : un refus
   * de jointure socket n'est pas une 404 HTTP, juste un événement `error`
   * côté client.
   */
  async isActiveParticipant(
    conversationId: string,
    actorId: string,
  ): Promise<boolean> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, actorId, leftAt: IsNull() },
    });
    return !!participant;
  }

  private async getConversationOrFail(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id } });
    if (!conversation) throw new ApiErrorNotFoundById('chat_conversations', id);
    return conversation;
  }

  /** Détail d'une conversation — utilisé par le panel admin (page de détail) */
  async getById(id: string): Promise<Conversation> {
    return this.getConversationOrFail(id);
  }

  /** Participants actifs — utilisé par le panel admin pour choisir la cible d'un handoff */
  async listActiveParticipants(conversationId: string): Promise<Participant[]> {
    await this.getConversationOrFail(conversationId);
    return this.participantRepo.find({
      where: { conversationId, leftAt: IsNull() },
      order: { joinedAt: 'ASC' },
    });
  }

  // ── Envoi de message ───────────────────────────────────────

  async sendMessage(
    conversationId: string,
    sender: Actor,
    dto: SendMessageDto,
  ): Promise<Message> {
    const conversation = await this.getConversationOrFail(conversationId);
    await this.validateActor(sender);

    const message = await this.dataSource.transaction(async (manager) => {
      const message = await manager.save(
        manager.create(Message, {
          conversationId,
          senderId: sender.actorId,
          senderType: sender.actorType,
          body: dto.body ?? undefined,
          replyTo: dto.replyTo ?? undefined,
        }),
      );

      message.attachments = [];
      for (const a of dto.attachments ?? []) {
        message.attachments.push(
          await manager.save(
            manager.create(Attachment, {
              messageId: message.id,
              kind: a.kind,
              url: a.url,
              meta: a.meta ?? undefined,
            }),
          ),
        );
      }

      await manager.update(Conversation, conversationId, {
        lastMessageAt: message.createdAt,
        lastMessagePreview: this.buildPreview(dto),
        lastMessageSenderId: sender.actorId,
      });

      return message;
    });

    this.realtime.emitToConversation(conversationId, 'message:new', { message });
    await this.emitConversationUpdated(conversationId);

    // Seul le visiteur (GUEST, bulle publique) doit déclencher une réponse du
    // bot — jamais un HUMAN : sur ce projet, HUMAN désigne toujours un membre
    // du clergé/staff répondant via le panel (ChatController), pas le
    // visiteur (cf. ChatService.sendGuestMessage, toujours GUEST). Avant ce
    // fix, un membre du clergé qui répondait sans avoir d'abord fait le
    // handoff (mode toujours BOT) déclenchait le message de repli du bot
    // juste après sa propre réponse — signalé par l'utilisateur.
    if (sender.actorType === ActorType.GUEST) {
      await this.autoReplyIfBot(conversation, dto.body);
    }

    return message;
  }

  // ── Envoi de message + fichiers en une requête (multipart) ────
  // Alternative à sendMessage + POST /chat/attachments préalable : les
  // fichiers sont uploadés et attachés au message dans la même transaction.

  async sendMessageWithFiles(
    conversationId: string,
    sender: Actor,
    dto: SendMessageWithFilesDto,
  ): Promise<Message> {
    const conversation = await this.getConversationOrFail(conversationId);
    await this.validateActor(sender);

    const attachments = (dto.files ?? []).map((file) =>
      this.storeAttachmentFile(file, dto.isVoice ? AttachmentKind.AUDIO : undefined),
    );

    const message = await this.dataSource.transaction(async (manager) => {
      const message = await manager.save(
        manager.create(Message, {
          conversationId,
          senderId: sender.actorId,
          senderType: sender.actorType,
          body: dto.body ?? undefined,
          replyTo: dto.replyTo ?? undefined,
        }),
      );

      message.attachments = [];
      for (const a of attachments) {
        message.attachments.push(
          await manager.save(
            manager.create(Attachment, {
              messageId: message.id,
              kind: a.kind,
              url: a.url,
            }),
          ),
        );
      }

      await manager.update(Conversation, conversationId, {
        lastMessageAt: message.createdAt,
        lastMessagePreview: this.buildPreviewText(
          dto.body,
          attachments[0]?.kind,
        ),
        lastMessageSenderId: sender.actorId,
      });

      return message;
    });

    this.realtime.emitToConversation(conversationId, 'message:new', { message });
    await this.emitConversationUpdated(conversationId);

    // Même règle que sendMessage() ci-dessus — seul le visiteur (GUEST)
    // déclenche une réponse du bot.
    if (sender.actorType === ActorType.GUEST) {
      await this.autoReplyIfBot(conversation, dto.body);
    }

    return message;
  }

  // ── Upload de pièce jointe (image, vidéo, audio/vocal, fichier) ──
  // Étape préalable à sendMessage : le client uploade le fichier, récupère
  // { kind, url }, puis référence cette entrée dans `attachments` en
  // envoyant le message (voir CreateAttachmentDto).

  uploadAttachment(file: FileSystemStoredFile): {
    kind: AttachmentKind;
    url: string;
  } {
    return this.storeAttachmentFile(file);
  }

  private storeAttachmentFile(
    file: FileSystemStoredFile,
    kindOverride?: AttachmentKind,
  ): { kind: AttachmentKind; url: string } {
    const dir = ApiFsUtils.createDir('chat');
    const key = `${Date.now()}${Math.ceil(Math.random() * 100)}`;
    const path = `${dir}/att_${key}.${file.extension}`;

    ApiFsUtils.saveFile(file.path, path);

    return {
      kind: kindOverride ?? this.inferAttachmentKind(file.mimetype),
      url: ApiFsUtils.pathToUrl(path),
    };
  }

  private inferAttachmentKind(mimetype: string): AttachmentKind {
    if (mimetype.startsWith('image/')) return AttachmentKind.IMAGE;
    if (mimetype.startsWith('audio/')) return AttachmentKind.AUDIO;
    if (mimetype.startsWith('video/')) return AttachmentKind.VIDEO;
    return AttachmentKind.FILE;
  }

  private buildPreview(dto: SendMessageDto): string {
    return this.buildPreviewText(dto.body, dto.attachments?.[0]?.kind);
  }

  private buildPreviewText(body?: string, firstAttachmentKind?: AttachmentKind): string {
    if (body?.trim()) {
      return body.length > PREVIEW_MAX_LENGTH
        ? `${body.slice(0, PREVIEW_MAX_LENGTH)}…`
        : body;
    }
    if (firstAttachmentKind) return `[${firstAttachmentKind}]`;
    return '';
  }

  // ── Liste des messages ─────────────────────────────────────

  async listMessages(
    conversationId: string,
    query: ListMessagesQuery,
  ): Promise<PaginatedMessages> {
    await this.getConversationOrFail(conversationId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));

    const [data, total] = await this.messageRepo.findAndCount({
      where: { conversationId },
      relations: { attachments: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ── Suppression d'un message (par l'expéditeur uniquement) ────
  // Le message reste dans le fil (placeholder « Message supprimé » côté
  // front, via contentDeletedAt) — body vidé, attachments supprimés
  // (DB + fichiers disque). Pas un DELETE de la ligne (voir Message.contentDeletedAt).

  async deleteMessage(messageId: string, actor: Actor): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: { attachments: true },
    });
    if (!message) throw new ApiErrorNotFoundById('chat_messages', messageId);

    if (message.senderId !== actor.actorId) {
      throw new ApiError('Vous ne pouvez supprimer que vos propres messages.', {
        code: HttpStatus.FORBIDDEN,
        displayable: true,
      });
    }

    if (message.contentDeletedAt) return message; // idempotent

    const deleted = await this.dataSource.transaction(async (manager) => {
      for (const attachment of message.attachments ?? []) {
        ApiFsUtils.removeFile(ApiFsUtils.urlToPath(attachment.url));
        await manager.delete(Attachment, attachment.id);
      }

      message.body = undefined;
      message.attachments = [];
      message.contentDeletedAt = new Date();
      await manager.save(message);

      const conversation = await manager.findOne(Conversation, {
        where: { id: message.conversationId },
      });
      if (conversation?.lastMessageAt?.getTime() === message.createdAt?.getTime()) {
        await manager.update(Conversation, message.conversationId, {
          lastMessagePreview: 'Message supprimé',
        });
      }

      return message;
    });

    this.realtime.emitToConversation(message.conversationId, 'message:deleted', {
      message: deleted,
    });
    await this.emitConversationUpdated(message.conversationId);

    return deleted;
  }

  // ── Marquer lu ─────────────────────────────────────────────

  async markRead(conversationId: string, actorId: string): Promise<void> {
    // Pas de `getActiveParticipant` (qui lève une 404) : un admin/engineer
    // peut consulter n'importe quelle conversation via `listAdmin`/`getById`
    // sans jamais en être devenu participant (ex. fil encore uniquement
    // BOT, ou quitté après un handoff) — dans ce cas, rien à marquer comme
    // lu pour lui, silencieusement, plutôt qu'une erreur à chaque ouverture.
    const participant = await this.participantRepo.findOne({
      where: { conversationId, actorId, leftAt: IsNull() },
    });
    if (!participant) return;

    const now = new Date();

    await this.participantRepo.update(participant.id, { lastReadAt: now });

    await this.messageRepo.update(
      { conversationId, senderId: Not(actorId), readAt: IsNull() },
      { readAt: now },
    );

    this.realtime.emitToConversation(conversationId, 'conversation:read', {
      conversationId,
      actorId,
      actorType: participant.actorType,
      lastReadAt: now,
    });
  }

  // ── Handoff BOT -> AGENT (sans émission système) ──────────

  async handoff(conversationId: string, dto: HandoffDto): Promise<Participant> {
    await this.getConversationOrFail(conversationId);
    await this.validateActor({
      actorId: dto.toActorId,
      actorType: dto.toActorType,
    });

    const bot = await this.getActiveParticipant(
      conversationId,
      dto.fromActorId,
    );

    const agent = await this.dataSource.transaction(async (manager) => {
      await manager.update(Participant, bot.id, { leftAt: new Date() });

      const agent = await manager.save(
        manager.create(Participant, {
          conversationId,
          actorId: dto.toActorId,
          actorType: dto.toActorType,
          role: dto.toRole,
        }),
      );

      await manager.update(Conversation, conversationId, {
        mode: ConversationMode.AGENT,
      });

      return agent;
    });

    await this.emitConversationUpdated(conversationId);

    return agent;
  }

  // ── Réponse automatique (mode BOT) ────────────────────────
  // Toujours après la transaction du message entrant, jamais dedans — un
  // échec de génération de réponse (FAQ indisponible, etc.) ne doit jamais
  // faire échouer l'envoi du message du fidèle/visiteur lui-même.

  private async autoReplyIfBot(
    conversation: Conversation,
    incomingBody?: string,
  ): Promise<void> {
    if (conversation.mode !== ConversationMode.BOT) return;

    const replyBody = await this.chatBotService.reply(incomingBody);
    const reply = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderType: ActorType.AI,
        body: replyBody,
      }),
    );

    await this.conversationRepo.update(conversation.id, {
      lastMessageAt: reply.createdAt,
      lastMessagePreview: this.buildPreviewText(replyBody),
      // `undefined` serait ignoré par TypeORM (omis du SET) — `null` explicite
      // nécessaire pour que `lastMessageSenderId` ne reste pas celui du
      // message entrant (fidèle/visiteur) alors que le dernier message est
      // désormais celui du bot (senderId nul, comme sur Message lui-même).
      lastMessageSenderId: null as unknown as string,
    });

    this.realtime.emitToConversation(conversation.id, 'message:new', {
      message: reply,
    });
    await this.emitConversationUpdated(conversation.id);
  }

  // ── Bulle publique (visiteur anonyme, ActorType.GUEST) ────
  // Même noyau (createOrOpen/sendMessage/listMessages) que le chat
  // authentifié, mais un visiteur n'a pas de compte à valider
  // (ChatService.validateActor ignore GUEST) et doit rester cantonné à SA
  // propre conversation — vérifié explicitement ici, jamais supposé.

  /** Ouvre (ou reprend) la conversation BOT d'un visiteur — un salut du bot au premier appel. */
  async openGuestConversation(guestId: string): Promise<Conversation> {
    const existing = await this.conversationRepo.findOne({
      where: { subjectType: GUEST_SUBJECT_TYPE, subjectId: guestId },
    });
    if (existing) return existing;

    const conversation = await this.conversationRepo.save(
      this.conversationRepo.create({
        subjectType: GUEST_SUBJECT_TYPE,
        subjectId: guestId,
        mode: ConversationMode.BOT,
      }),
    );

    await this.participantRepo.save(
      this.participantRepo.create({
        conversationId: conversation.id,
        actorId: guestId,
        actorType: ActorType.GUEST,
        role: ParticipantRole.OWNER,
      }),
    );

    const greeting = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderType: ActorType.AI,
        body: CHAT_BOT_GREETING,
      }),
    );
    await this.conversationRepo.update(conversation.id, {
      lastMessageAt: greeting.createdAt,
      lastMessagePreview: this.buildPreviewText(CHAT_BOT_GREETING),
    });

    this.realtime.emitToAdmins('conversation:updated', {
      conversation: this.toRealtimeSummary({
        ...conversation,
        lastMessageAt: greeting.createdAt,
        lastMessagePreview: this.buildPreviewText(CHAT_BOT_GREETING),
      }),
    });

    return conversation;
  }

  /** Lève une 404 si `guestId` n'est pas (ou plus) participant actif de `conversationId`. */
  private async assertGuestOwnsConversation(
    conversationId: string,
    guestId: string,
  ): Promise<void> {
    await this.getActiveParticipant(conversationId, guestId);
  }

  async sendGuestMessage(
    conversationId: string,
    guestId: string,
    body: string,
  ): Promise<Message> {
    await this.assertGuestOwnsConversation(conversationId, guestId);
    return this.sendMessage(
      conversationId,
      { actorId: guestId, actorType: ActorType.GUEST },
      { body },
    );
  }

  async listGuestMessages(
    conversationId: string,
    guestId: string,
    query: ListMessagesQuery,
  ): Promise<PaginatedMessages> {
    await this.assertGuestOwnsConversation(conversationId, guestId);
    return this.listMessages(conversationId, query);
  }
}
