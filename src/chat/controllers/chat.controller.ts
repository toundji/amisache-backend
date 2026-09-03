// ============================================================
// UNIFIED AUTH — chat.controller.ts
// Routes /chat/conversations/* — sous les guards globaux (RequireAuthGuard).
// L'appelant HTTP authentifié est toujours un acteur HUMAN ; les acteurs
// AI/SYSTEM (bot, handoff) ne transitent que par des champs de DTO,
// jamais déduits du JWT. Ce controller ne contient AUCUNE logique
// métier, il délègue tout au ChatService.
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

import { ChatService } from '../services/chat.service';
import { GetUser } from '../../core/decorators/api.decorator';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { ActorType } from '../../shared/common.enum';
import { AttachmentUploadDto } from '../../shared/media.dto';

import { CreateConversationDto } from '../dto/conversation.dto';
import type { ListConversationsQuery } from '../dto/conversation.dto';
import { SendMessageDto, SendMessageWithFilesDto } from '../dto/message.dto';
import type { ListMessagesQuery } from '../dto/message.dto';
import { HandoffDto } from '../dto/handoff.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat/conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat/conversations
   * Ouvre un nouveau fil, ou réutilise le fil existant si subjectType +
   * subjectId sont fournis et correspondent à une conversation existante.
   */
  @Post()
  @ApiOperation({ summary: 'Ouvrir (ou réutiliser) une conversation' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateConversationDto) {
    return this.chatService.createOrOpen(
      { actorId: user.id, actorType: ActorType.HUMAN },
      body,
    );
  }

  /**
   * GET /chat/conversations
   * Mes conversations actives, triées par dernière activité.
   */
  @Get()
  @ApiOperation({ summary: 'Lister mes conversations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  myConversations(
    @GetUser() user: JwtUserInfo,
    @Query() query: ListConversationsQuery,
  ) {
    return this.chatService.myConversations(user.id, query);
  }

  /**
   * GET /chat/conversations/:id
   */
  @Get(':id')
  @ApiOperation({ summary: "Détail d'une conversation" })
  getById(@Param('id') id: string) {
    return this.chatService.getById(id);
  }

  /**
   * GET /chat/conversations/:id/participants
   */
  @Get(':id/participants')
  @ApiOperation({
    summary:
      "Lister les participants actifs (pour choisir la cible d'un handoff)",
  })
  listParticipants(@Param('id') id: string) {
    return this.chatService.listActiveParticipants(id);
  }

  /**
   * GET /chat/conversations/:id/unread-count
   */
  @Get(':id/unread-count')
  @ApiOperation({ summary: 'Nombre de messages non lus dans une conversation' })
  unreadCount(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.chatService.getUnreadCount(id, user.id);
  }

  /**
   * GET /chat/conversations/:id/messages
   */
  @Get(':id/messages')
  @ApiOperation({ summary: "Lister les messages d'une conversation (paginé)" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listMessages(@Param('id') id: string, @Query() query: ListMessagesQuery) {
    return this.chatService.listMessages(id, query);
  }

  /**
   * POST /chat/conversations/:id/messages
   */
  @Post(':id/messages')
  @ApiOperation({ summary: 'Envoyer un message' })
  sendMessage(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      id,
      { actorId: user.id, actorType: ActorType.HUMAN },
      body,
    );
  }

  /**
   * POST /chat/conversations/:id/messages/with-files
   * Variante multipart : texte + fichiers (image/vidéo/vocal/document)
   * uploadés et attachés en une seule requête, sans passer par
   * POST /chat/attachments au préalable.
   */
  @Post(':id/messages/with-files')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envoyer un message avec fichiers joints (upload direct)' })
  sendMessageWithFiles(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: SendMessageWithFilesDto,
  ) {
    return this.chatService.sendMessageWithFiles(
      id,
      { actorId: user.id, actorType: ActorType.HUMAN },
      body,
    );
  }

  /**
   * DELETE /chat/conversations/:id/messages/:messageId
   * Supprime le contenu d'un message (body + attachments) — réservé à
   * l'expéditeur. Le message reste dans le fil comme placeholder
   * « Message supprimé » (voir Message.contentDeletedAt).
   */
  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Supprimer un message (expéditeur uniquement)' })
  deleteMessage(
    @GetUser() user: JwtUserInfo,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.deleteMessage(messageId, {
      actorId: user.id,
      actorType: ActorType.HUMAN,
    });
  }

  /**
   * PATCH /chat/conversations/:id/read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer la conversation comme lue' })
  markRead(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.chatService.markRead(id, user.id);
  }

  /**
   * POST /chat/conversations/:id/handoff
   * Transfert BOT -> AGENT — n'émet aucun message SYSTEM (hors périmètre).
   */
  @Post(':id/handoff')
  @ApiOperation({ summary: 'Transférer une conversation du bot vers un agent' })
  handoff(@Param('id') id: string, @Body() body: HandoffDto) {
    return this.chatService.handoff(id, body);
  }
}

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat/attachments')
export class ChatAttachmentsController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat/attachments
   * Upload d'un fichier (image, vidéo, audio/vocal, document) — préalable
   * à l'envoi d'un message. Retourne { kind, url } à référencer dans
   * `attachments` sur POST /chat/conversations/:id/messages.
   */
  @Post()
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Uploader une pièce jointe (image, vidéo, vocal, document)',
  })
  upload(@Body() body: AttachmentUploadDto) {
    return this.chatService.uploadAttachment(body.file);
  }
}
