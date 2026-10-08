// ============================================================
// AMISACHE — assistant.constants.ts
// Paramètres de l'assistant LLM du chat (voir chatbot-llm-spec.md).
// Fournisseur : OpenRouter (API au format OpenAI, tous modèles).
// ============================================================

/** Token d'injection du client LLM — `null` si OPENROUTER_API_KEY est absent. */
export const LLM_CLIENT = Symbol('LLM_CLIENT');

/**
 * Modèle(s) OpenRouter — plusieurs séparés par des virgules = ordre de repli
 * géré par OpenRouter (utile sur les modèles gratuits, souvent saturés).
 * Le modèle doit gérer les tools (filtre « Tools » sur openrouter.ai/models).
 */
export const ASSISTANT_MODELS = (
  process.env.OPENROUTER_MODEL ||
  'nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3-ultra-550b-a55b:free'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Tours de tool_calls max par message utilisateur */
export const MAX_TOOL_ROUNDS = 5;
/** Messages texte de la conversation renvoyés au LLM (≈ 5 échanges) */
export const HISTORY_LIMIT = 10;
export const CALL_TIMEOUT_MS = 20_000;
/** Une demande enchaîne jusqu'à 4 appels (paroisse, types, messes, préparation) à 6-15 s chacun sur un modèle gratuit */
export const TOTAL_TIMEOUT_MS = 60_000;

/** Alerte admin « assistant indisponible » : au plus une par fenêtre */
export const ALERT_THROTTLE_SECONDS = 15 * 60;

export const DEFAULT_TIMEZONE = 'Africa/Porto-Novo';

export const LOOP_LIMIT_REPLY =
  "Je n'ai pas réussi à trouver une réponse fiable. Je transmets votre question " +
  "à l'équipe, quelqu'un vous répondra ici dès que possible.";

// ── Format des messages (API chat completions, format OpenAI) ──

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface LlmAssistantMessage {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: LlmToolCall[] | null;
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export interface LlmClient {
  /** Une complétion ; lève une erreur si le fournisseur échoue ou dépasse `timeoutMs`. */
  complete(
    request: { messages: LlmMessage[]; tools: unknown[] },
    timeoutMs: number,
  ): Promise<{ message: LlmAssistantMessage; model?: string }>;
}
