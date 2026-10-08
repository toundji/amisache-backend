// ============================================================
// AMISACHE — llm-chat-bot.service.ts
// Moteur LLM (OpenRouter, function calling) du bot du chat — enregistré
// auprès de ChatBotService au démarrage, remplace la recherche mot-clé
// (qui reste le repli si le LLM est indisponible). Voir
// chatbot-llm-spec.md.
//
// Le LLM ne répond qu'à partir des résultats de tools, ou escalade vers
// un humain ; seules exceptions : salutations, remerciements et prières.
// ============================================================
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  BotReply,
  BotReplyContext,
  ChatBotEngine,
  ChatBotService,
} from '../../chat/services/chat-bot.service';
import { ChatService } from '../../chat/services/chat.service';
import { ActorType } from '../../shared/common.enum';
import { ChurchService } from '../../church/services/church.service';
import {
  CALL_TIMEOUT_MS,
  HISTORY_LIMIT,
  LLM_CLIENT,
  LOOP_LIMIT_REPLY,
  LlmAssistantMessage,
  LlmMessage,
  MAX_TOOL_ROUNDS,
  TOTAL_TIMEOUT_MS,
} from '../assistant.constants';
import type { LlmClient } from '../assistant.constants';
import { buildSystemPrompt, resolveTimezone } from '../assistant.prompt';
import {
  ASSISTANT_TOOLS,
  AssistantToolsService,
  ToolContext,
  ToolRunState,
} from './assistant-tools.service';
import { AssistantNotifierService } from './assistant-notifier.service';

/** Temps restant minimal pour retenter un appel LLM en échec */
const MIN_RETRY_BUDGET_MS = 5_000;

interface ToolTrace {
  name: string;
  args: unknown;
  result: unknown;
  durationMs: number;
}

@Injectable()
export class LlmChatBotService implements ChatBotEngine, OnModuleInit {
  private readonly logger = new Logger(LlmChatBotService.name);

  constructor(
    @Inject(LLM_CLIENT) private readonly client: LlmClient | null,
    private readonly chatBotService: ChatBotService,
    private readonly chatService: ChatService,
    private readonly churchService: ChurchService,
    private readonly tools: AssistantToolsService,
    private readonly notifier: AssistantNotifierService,
  ) {}

  onModuleInit(): void {
    if (!this.client) {
      this.logger.warn('OPENROUTER_API_KEY absent — le bot reste sur la recherche mot-clé.');
      return;
    }
    this.chatBotService.registerEngine(this);
  }

  async reply(ctx: BotReplyContext): Promise<BotReply | null> {
    const startedAt = Date.now();
    const deadline = startedAt + TOTAL_TIMEOUT_MS;
    const trace: ToolTrace[] = [];
    const run: ToolRunState = { reEscalated: false };
    const models = new Set<string>();
    const toolCtx: ToolContext = {
      conversationId: ctx.conversation.id,
      userId: ctx.actorId,
      clientContext: ctx.clientContext,
    };
    const meta = (extra: Record<string, any> = {}) => ({
      model: Array.from(models).join(', '),
      trace,
      durationMs: Date.now() - startedAt,
      ...extra,
    });

    try {
      const messages = await this.buildMessages(ctx);

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const { message, model } = await this.complete(messages, deadline);
        if (model) models.add(model);
        const toolCalls = message.tool_calls ?? [];

        if (toolCalls.length === 0) {
          if (run.reEscalated) return null;
          return {
            body: this.withRequestLink(message.content ?? '', run),
            meta: meta({ rounds: round + 1 }),
            options: run.options,
          };
        }

        messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: toolCalls });
        for (const call of toolCalls) {
          const args = this.parseArgs(call.function.arguments);
          const toolStartedAt = Date.now();
          const result = await this.tools
            .execute(call.function.name, args, toolCtx, run)
            .catch((error: Error) => ({ error: error.message }));
          trace.push({
            name: call.function.name,
            args,
            result,
            durationMs: Date.now() - toolStartedAt,
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Trop de tours : on transmet plutôt que de risquer une réponse inventée.
      // Un échec ici n'est pas une panne du LLM : pas de repli ni d'alerte.
      await this.tools
        .escalate(
          toolCtx,
          run,
          `Limite de ${MAX_TOOL_ROUNDS} tours atteinte par l'assistant. Question : ${ctx.body ?? ''}`,
        )
        .catch((error: Error) => this.logger.error('Escalade en échec', error));
      if (run.reEscalated) return null;
      return { body: LOOP_LIMIT_REPLY, meta: meta({ loopLimit: true }) };
    } catch (error) {
      this.logger.error('LLM indisponible — repli sur la recherche mot-clé', error as Error);
      await this.notifier.alertLlmUnavailable(error);
      return {
        body: await this.chatBotService.keywordReply(ctx.body),
        meta: meta({ fallback: true, error: (error as Error)?.message }),
      };
    }
  }

  /** Bouton vers le formulaire prérempli par `prepare_request` — lien construit côté serveur, jamais par le LLM. */
  private withRequestLink(body: string, run: ToolRunState): string {
    if (!run.requestFormUrl) return body;
    // URLSearchParams laisse les parenthèses telles quelles — une « ) » du texte d'intention couperait le lien Markdown.
    const url = run.requestFormUrl.replace(/\(/g, '%28').replace(/\)/g, '%29');
    return `${body}\n\n[Finaliser ma demande →](${url})`;
  }

  private async buildMessages(ctx: BotReplyContext): Promise<LlmMessage[]> {
    const slug = ctx.clientContext?.churchSlug?.trim();
    const church = slug
      ? await this.churchService.getPublicBySlug(slug).catch(() => null)
      : null;

    const system = buildSystemPrompt({
      now: new Date(),
      timezone: resolveTimezone(ctx.clientContext?.timezone),
      church: church ? { name: church.name, slug: church.slug } : undefined,
    });

    // Le message courant est déjà persisté : il est le dernier de l'historique.
    const history = await this.chatService.recentTextMessages(ctx.conversation.id, HISTORY_LIMIT);
    return [
      { role: 'system', content: system },
      ...history.map((m): LlmMessage =>
        m.senderType === ActorType.AI
          ? { role: 'assistant', content: m.body ?? '' }
          : { role: 'user', content: m.body ?? '' },
      ),
    ];
  }

  private async complete(
    messages: LlmMessage[],
    deadline: number,
  ): Promise<{ message: LlmAssistantMessage; model?: string }> {
    const attempt = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Délai total de ${TOTAL_TIMEOUT_MS} ms dépassé`);
      return this.client!.complete(
        { messages, tools: ASSISTANT_TOOLS },
        Math.min(CALL_TIMEOUT_MS, remaining),
      );
    };

    try {
      return await attempt();
    } catch (error) {
      // Les modèles gratuits échouent souvent de façon passagère (surcharge,
      // réponse vide) : une seconde tentative s'il reste du temps.
      if (deadline - Date.now() < MIN_RETRY_BUDGET_MS) throw error;
      this.logger.warn(`Nouvelle tentative LLM après : ${(error as Error).message}`);
      return attempt();
    }
  }

  private parseArgs(raw: string | Record<string, any>): Record<string, any> {
    if (typeof raw !== 'string') return raw ?? {};
    try {
      return raw.trim() ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}
