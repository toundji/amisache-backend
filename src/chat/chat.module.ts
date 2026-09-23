// ============================================================
// chat.module.ts
// Messagerie multi-acteurs (usager/agent/client/chauffeur/bot) —
// noyau uniquement, voir prompt-claude-code-chat.md § Périmètre.
// Dépend de users/ pour valider l'existence d'un acteur HUMAN
// (UserService.getById) — pas de FK SQL sur actorId/senderId.
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ContentModule } from '../content/content.module';

import { Conversation } from './entities/conversation.entity';
import { Participant } from './entities/participant.entity';
import { Message } from './entities/message.entity';
import { Attachment } from './entities/attachment.entity';

import {
  ChatController,
  ChatAttachmentsController,
} from './controllers/chat.controller';
import { ChatGuestController } from './controllers/chat-guest.controller';
import { ChatService } from './services/chat.service';
import { ChatBotService } from './services/chat-bot.service';
import { ChatRealtimeService } from './services/chat-realtime.service';
import { ChatGateway } from './gateways/chat.gateway';
import { WebSocketAuthMiddleware } from '../core/middleware/api-middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Participant, Message, Attachment]),
    UsersModule,
    ContentModule, // FaqService — réponse automatique du bot (voir ChatBotService)
  ],
  controllers: [ChatController, ChatAttachmentsController, ChatGuestController],
  providers: [
    ChatService,
    ChatBotService,
    ChatRealtimeService,
    ChatGateway,
    WebSocketAuthMiddleware, // scaffolding du socle, jusqu'ici jamais instancié — voir ChatGateway
  ],
  exports: [ChatService],
})
export class ChatModule {}
