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
import {
  ActorType,
  AttachmentKind,
  ConversationMode,
  ParticipantRole,
} from '../../shared/common.enum';
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

const PREVIEW_MAX_LENGTH = 140;

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
  ) { }

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
    await this.getConversationOrFail(conversationId);
    await this.validateActor(sender);

    return this.dataSource.transaction(async (manager) => {
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
  }

  // ── Envoi de message + fichiers en une requête (multipart) ────
  // Alternative à sendMessage + POST /chat/attachments préalable : les
  // fichiers sont uploadés et attachés au message dans la même transaction.

  async sendMessageWithFiles(
    conversationId: string,
    sender: Actor,
    dto: SendMessageWithFilesDto,
  ): Promise<Message> {
    await this.getConversationOrFail(conversationId);
    await this.validateActor(sender);

    const attachments = (dto.files ?? []).map((file) =>
      this.storeAttachmentFile(file, dto.isVoice ? AttachmentKind.AUDIO : undefined),
    );

    return this.dataSource.transaction(async (manager) => {
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

    return this.dataSource.transaction(async (manager) => {
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
  }

  // ── Marquer lu ─────────────────────────────────────────────

  async markRead(conversationId: string, actorId: string): Promise<void> {
    const participant = await this.getActiveParticipant(
      conversationId,
      actorId,
    );
    const now = new Date();

    await this.participantRepo.update(participant.id, { lastReadAt: now });

    await this.messageRepo.update(
      { conversationId, senderId: Not(actorId), readAt: IsNull() },
      { readAt: now },
    );
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

    return this.dataSource.transaction(async (manager) => {
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
  }
}
