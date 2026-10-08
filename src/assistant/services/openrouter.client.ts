// ============================================================
// AMISACHE — openrouter.client.ts
// Client minimal de l'API chat completions d'OpenRouter (format OpenAI)
// — fetch natif, sans SDK : une seule route utilisée.
// ============================================================
import { ASSISTANT_MODELS, LlmClient, LlmAssistantMessage, LlmMessage } from '../assistant.constants';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterClient implements LlmClient {
  constructor(private readonly apiKey: string) {}

  async complete(
    request: { messages: LlmMessage[]; tools: unknown[] },
    timeoutMs: number,
  ): Promise<{ message: LlmAssistantMessage; model?: string }> {
    const [primary, ...fallbacks] = ASSISTANT_MODELS;
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'x-title': 'Amisache',
      },
      body: JSON.stringify({
        model: primary,
        // Modèles de repli, essayés par OpenRouter si le premier échoue
        ...(fallbacks.length ? { models: ASSISTANT_MODELS } : {}),
        messages: request.messages,
        tools: request.tools,
        tool_choice: 'auto',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const payload = (await response.json().catch(() => null)) as {
      model?: string;
      choices?: Array<{ message?: LlmAssistantMessage }>;
      error?: { code?: number; message?: string };
    } | null;

    if (!response.ok || payload?.error) {
      throw new Error(
        `OpenRouter ${payload?.error?.code ?? response.status} : ${payload?.error?.message ?? response.statusText}`,
      );
    }

    const message = payload?.choices?.[0]?.message;
    if (!message) throw new Error('Réponse OpenRouter vide');
    return { message, model: payload?.model };
  }
}
