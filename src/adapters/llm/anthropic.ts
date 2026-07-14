import type { LlmProvider, LlmCompleteOptions } from '../../core/ports/llm-provider';
import type { ChatMessage } from '../../core/entities/chat-message';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5';

/**
 * Quality-upgrade LlmProvider (spec sections 4 & 8) — REST, streaming, activated purely by
 * setting `ANTHROPIC_API_KEY` (see src/config/llm.ts). Fully implemented (not a stub) since the
 * spec calls this "the planned quality upgrade" — switching primary from Workers AI to Anthropic
 * is a one-line config change once the key exists, no code change required.
 *
 * Uses `fetch` + the Messages API's SSE stream directly rather than the Anthropic SDK, keeping
 * this adapter dependency-free and Workers-runtime-safe (no Node-only APIs).
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL
  ) {}

  async *complete(messages: ChatMessage[], opts?: LlmCompleteOptions): AsyncIterable<string> {
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        system: systemParts.join('\n\n'),
        messages: conversation,
        max_tokens: opts?.maxTokens ?? 800,
        temperature: opts?.temperature,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();

          try {
            const parsed = JSON.parse(payload) as {
              type: string;
              delta?: { type: string; text?: string };
            };
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch {
            // Ignore malformed SSE chunks rather than aborting the whole stream.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
