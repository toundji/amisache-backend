// ============================================================
// AMISACHE — chat-bot.service.ts
// Réponse automatique « basique » pour une conversation en mode BOT —
// PAS un LLM (décision explicite, cf. EVOLUTION.md) : correspondance par
// mots-clés contre les FAQ déjà publiées (content/Faq), avec un message
// de repli si rien ne correspond. Objectif : la bulle a une vraie réponse
// dès l'ouverture, sans dépendance à un fournisseur d'IA externe.
// ============================================================
import { Injectable } from '@nestjs/common';
import { FaqService } from '../../content/services/faq.service';
import { Faq } from '../../content/entities/faq.entity';

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
  constructor(private readonly faqService: FaqService) {}

  /** Réponse automatique à un message reçu dans une conversation BOT. */
  async reply(messageBody: string | undefined): Promise<string> {
    const faqs = await this.faqService.listPublished({});
    const match = this.bestMatch(messageBody, faqs);
    return match?.answer ?? CHAT_BOT_FALLBACK;
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
