import type { ChatMessage } from '../entities/chat-message';

export interface LlmCompleteOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Finalized in phase 4. Adapters (Workers AI, Anthropic, Echo dev fallback) implement this;
 * `src/adapters/llm/router.ts` picks the concrete instance per `src/config/llm.ts` and falls
 * through to the next provider in the chain on error.
 */
export interface LlmProvider {
  /** Diagnostic name used in router fallback logging (e.g. "workers-ai", "anthropic", "echo-dev"). */
  readonly name: string;
  complete(messages: ChatMessage[], opts?: LlmCompleteOptions): AsyncIterable<string>;
}
