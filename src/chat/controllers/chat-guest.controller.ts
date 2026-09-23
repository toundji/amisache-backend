// ============================================================
// AMISACHE — chat-guest.controller.ts
// Routes publiques /chat/guest/* — la bulle de chat doit s'afficher et
// fonctionner sur tout le portail, y compris pour un visiteur non
// connecté (décision explicite, cf. EVOLUTION.md). @Public() lève
// RequireAuthGuard (pas ApiKeyGuard — la clé API website reste
// obligatoire, comme toute route publique du portail). Aucune route ici
// ne réutilise ChatController : l'identité vient du corps/de la query
// (`guestId`), jamais du JWT, et chaque accès est vérifié appartenir à
// CE visiteur (ChatService.assertGuestOwnsConversation) — un visiteur ne
// doit jamais pouvoir lire la conversation d'un autre en devinant un id.
// ============================================================
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/decorators/api.decorator';
import { ChatService } from '../services/chat.service';
import { OpenGuestConversationDto, SendGuestMessageDto } from '../dto/guest.dto';
import type { ListGuestMessagesQuery } from '../dto/guest.dto';

@ApiTags('Chat (visiteur anonyme)')
@Controller('chat/guest')
export class ChatGuestController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat/guest/conversations
   * Ouvre (ou reprend) la conversation BOT d'un visiteur anonyme —
   * idempotent par `guestId` (même identifiant = même fil, cf.
   * `subjectType='guest-widget'`).
   */
  @Public()
  @Post('conversations')
  @ApiOperation({ summary: "Ouvrir/reprendre la conversation d'un visiteur anonyme" })
  open(@Body() body: OpenGuestConversationDto) {
    return this.chatService.openGuestConversation(body.guestId);
  }

  /**
   * GET /chat/guest/conversations/:id/messages?guestId=
   */
  @Public()
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: "Lister les messages de la conversation d'un visiteur" })
  @ApiQuery({ name: 'guestId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listMessages(
    @Param('id') id: string,
    @Query() query: ListGuestMessagesQuery,
  ) {
    return this.chatService.listGuestMessages(id, query.guestId, query);
  }

  /**
   * POST /chat/guest/conversations/:id/messages
   */
  @Public()
  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Envoyer un message en tant que visiteur anonyme' })
  sendMessage(@Param('id') id: string, @Body() body: SendGuestMessageDto) {
    return this.chatService.sendGuestMessage(id, body.guestId, body.body);
  }
}
