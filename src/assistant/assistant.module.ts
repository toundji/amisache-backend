// ============================================================
// AMISACHE — assistant.module.ts
// Assistant LLM du chat (OpenRouter, function calling) — chatbot-llm-spec.md.
// Module métier : dépend de chat/, church/, liturgy/ ; chat/ ne le
// connaît pas (le moteur s'enregistre auprès de ChatBotService au
// démarrage — AMISACHE.md §6.1, chat/ reste polymorphe).
// ============================================================
import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatModule } from '../chat/chat.module';
import { ChurchModule } from '../church/church.module';
import { LiturgyModule } from '../liturgy/liturgy.module';
import { ClergyMember } from '../church/entities/clergy-member.entity';
import { Schedule } from '../liturgy/entities/schedule.entity';
import { User } from '../users/entities/user.entity';

import { ASSISTANT_MODELS, LLM_CLIENT } from './assistant.constants';
import { OpenRouterClient } from './services/openrouter.client';
import { LlmChatBotService } from './services/llm-chat-bot.service';
import { AssistantToolsService } from './services/assistant-tools.service';
import { AssistantNotifierService } from './services/assistant-notifier.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClergyMember, Schedule, User]),
    ChatModule,
    ChurchModule,
    LiturgyModule,
  ],
  providers: [
    {
      provide: LLM_CLIENT,
      useFactory: () => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const openRouter = apiKey ? new OpenRouterClient(apiKey) : null;

        if (openRouter) {
          new Logger('AssistantModule').log(
            `Assistant LLM : openrouter (${ASSISTANT_MODELS.join(', ')})`,
          );
        }
        return openRouter;
      },
    },
    LlmChatBotService,
    AssistantToolsService,
    AssistantNotifierService,
  ],
})
export class AssistantModule {}
