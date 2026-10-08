// ============================================================
// AMISACHE — chat-bot.service.ts
// Réponse automatique pour une conversation en mode BOT.
//
// Moteur enfichable : un module métier (assistant/, LLM Mistral — voir
// chatbot-llm-spec.md) enregistre son moteur via `registerEngine()` au
// démarrage. chat/ ne l'importe jamais (il dépend de church/ et liturgy/,
// ce que chat/ n'a pas le droit de faire — AMISACHE.md §6.1).
//
// Sans moteur enregistré (ou en repli quand le LLM est indisponible) :
// correspondance par mots-clés contre les FAQ publiées (content/Faq), avec
// un message de repli si rien ne correspond.
// ============================================================
import { Injectable } from '@nestjs/common';
import { FaqService } from '../../content/services/faq.service';
import { Faq } from '../../content/entities/faq.entity';
import { Conversation } from '../entities/conversation.entity';
import { BotClientContextDto } from '../dto/message.dto';
import { MessageOption } from '../entities/message.entity';

export interface BotReplyContext {
  conversation: Conversation;
  /** Utilisateur (HUMAN) ou visiteur (GUEST) auteur du message */
  actorId: string;
  body?: string;
  clientContext?: BotClientContextDto;
}

export interface BotReply {
  body: string;
  /** Trace technique stockée sur Message.meta — jamais affichée */
  meta?: Record<string, any>;
  /** Choix cliquables affichés sous la réponse */
  options?: MessageOption[];
}

export interface ChatBotEngine {
  /** `null` = le bot reste silencieux (aucun message posté) */
  reply(ctx: BotReplyContext): Promise<BotReply | null>;
}

export const CHAT_BOT_GREETING =
  "Bonjour \u{1F44B} Je suis l'assistant Amisache. Posez votre question ci-dessous — " +
  "si je ne trouve pas de réponse, un membre de l'équipe prendra le relais.";

const CHAT_BOT_FALLBACK =
  "Je n'ai pas de réponse toute prête pour cette question. Un membre de l'équipe la " +
  'consultera et vous répondra ici dès que possible.';

/** Mots trop fréquents pour discriminer une question — ignorés du score de correspondance. */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'est',
  'sont', 'que', 'qui', 'quoi', 'quand', 'comment', 'pourquoi', 'pour',
  'avec', 'sans', 'sur', 'dans', 'par', 'ce', 'cette', 'ces', 'mon', 'ma',
  'mes', 'votre', 'vos', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous',
  'ils', 'elles', 'a', 'au', 'aux', 'se', 'ne', 'pas', 'plus', "j'ai",
  'comment', 'faire', 'peut', 'puis', 'y', 'en'
]);

const MIN_MATCH_SCORE = 1;

@Injectable()
export class ChatBotService {
  private engine?: ChatBotEngine;

  constructor(private readonly faqService: FaqService) {}

  registerEngine(engine: ChatBotEngine): void {
    this.engine = engine;
  }

  /** Réponse automatique à un message reçu dans une conversation BOT. */
  async reply(ctx: BotReplyContext): Promise<BotReply | null> {
    if (this.engine) return this.engine.reply(ctx);
    return { body: await this.keywordReply(ctx.body) };
  }

  /** Moteur mot-clé — aussi le repli du moteur LLM quand Mistral est indisponible. */
  async keywordReply(messageBody: string | undefined): Promise<string> {
    return (await this.findFaq(messageBody))?.answer ?? CHAT_BOT_FALLBACK;
  }

  /** Meilleure FAQ publiée pour `text`, ou null — réutilisée par le tool `search_faq`. */
  async findFaq(text: string | undefined): Promise<Faq | null> {
    const faqs = await this.faqService.listPublished({});
    return this.bestMatch(text, faqs);
  }

  private bestMatch(text: string | undefined, faqs: Faq[]): Faq | null {
    const words = this.tokenize(text);
    if (words.size === 0) return null;

    let best: { faq: Faq; score: number } | null = null;
    for (const faq of faqs) {
      const score = this.overlapScore(words, this.tokenize(faq.question));
      if (score >= MIN_MATCH_SCORE && (!best || score > best.score)) {
        best = { faq, score };
      }
    }
    return best?.faq ?? null;
  }

  private tokenize(text?: string): Set<string> {
    if (!text?.trim()) return new Set();
    return new Set(
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // accents
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    );
  }

  private overlapScore(a: Set<string>, b: Set<string>): number {
    let score = 0;
    for (const word of a) if (b.has(word)) score++;
    return score;
  }
}
