import type { LlmProvider, LlmCompleteOptions } from '../../core/ports/llm-provider';
import type { ChatMessage } from '../../core/entities/chat-message';

/**
 * Config-driven provider selection + fallback chain (spec section 8's config sketch). Tries
 * `primary` first; if it throws before yielding anything, falls through to the next provider in
 * `fallbacks`, in order. Once a provider has started yielding output, a later error is surfaced
 * (rather than silently retried) to avoid duplicating partially-streamed text to the client.
 */
export class LlmRouter implements LlmProvider {
  readonly name = 'router';

  constructor(
    private readonly primary: LlmProvider,
    private readonly fallbacks: LlmProvider[] = []
  ) {}

  async *complete(messages: ChatMessage[], opts?: LlmCompleteOptions): AsyncIterable<string> {
    const chain = [this.primary, ...this.fallbacks];
    let lastError: unknown;

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      let yieldedAny = false;

      try {
        for await (const chunk of provider.complete(messages, opts)) {
          yieldedAny = true;
          yield chunk;
        }
        return; // Completed successfully.
      } catch (error) {
        lastError = error;
        console.error(`[llm-router] provider "${provider.name}" failed:`, error);

        if (yieldedAny) {
          // Already streamed partial output to the client — don't retry with a different
          // provider mid-stream, that would duplicate/garble what the client already received.
          throw error;
        }
        // Otherwise fall through to the next provider in the chain.
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('All LLM providers in the fallback chain failed.');
  }
}
