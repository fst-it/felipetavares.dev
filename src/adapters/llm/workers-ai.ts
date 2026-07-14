import type { LlmProvider, LlmCompleteOptions } from '../../core/ports/llm-provider';
import type { ChatMessage } from '../../core/entities/chat-message';

/**
 * Minimal shape of the Cloudflare Workers AI binding this adapter needs. Shared across the LLM
 * (chat completion) and embedding (bge-base-en-v1.5) adapters via overloads, since both bind to
 * the same `env.AI` object in production.
 */
export interface AiBindingLike {
  run(
    model: string,
    input: {
      messages: { role: string; content: string }[];
      max_tokens?: number;
      temperature?: number;
      stream?: boolean;
    }
  ): Promise<ReadableStream<Uint8Array> | { response: string }>;
  run(model: string, input: { text: string[] }): Promise<{ data: number[][] }>;
}

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Production primary LlmProvider (spec section 8) — Llama 3.3 70B via the Workers AI binding,
 * streaming. Only constructed when `env.AI` is present (see src/config/llm.ts); local dev has no
 * such binding, so `EchoDevProvider` runs instead. Workers AI streams newline-delimited
 * `data: {...}` SSE chunks shaped like OpenAI's chat-completions stream; this adapter parses that
 * format and yields plain text deltas so callers stay provider-agnostic.
 */
export class WorkersAiProvider implements LlmProvider {
  readonly name = 'workers-ai';

  constructor(
    private readonly ai: AiBindingLike,
    private readonly model: string = DEFAULT_MODEL
  ) {}

  async *complete(messages: ChatMessage[], opts?: LlmCompleteOptions): AsyncIterable<string> {
    const result = await this.ai.run(this.model, {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: opts?.maxTokens,
      temperature: opts?.temperature,
      stream: true,
    });

    if (!(result instanceof ReadableStream)) {
      if (result.response) yield result.response;
      return;
    }

    const reader = result.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as { response?: string };
            if (parsed.response) yield parsed.response;
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
