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

import { Conversation } from './entities/conversation.entity';
import { Participant } from './entities/participant.entity';
import { Message } from './entities/message.entity';
import { Attachment } from './entities/attachment.entity';

import {
  ChatController,
  ChatAttachmentsController,
} from './controllers/chat.controller';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Participant, Message, Attachment]),
    UsersModule,
  ],
  controllers: [ChatController, ChatAttachmentsController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
