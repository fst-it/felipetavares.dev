import type { LlmProvider } from '../core/ports/llm-provider';
import type { EmbeddingIndex } from '../core/ports/embedding-index';
import { LlmRouter } from '../adapters/llm/router';
import { WorkersAiProvider, type AiBindingLike } from '../adapters/llm/workers-ai';
import { AnthropicProvider } from '../adapters/llm/anthropic';
import { EchoDevProvider } from '../adapters/llm/echo-dev';
import { LexicalIndex } from '../adapters/embedding-index/lexical-index';
import { VectorizeIndex, type VectorizeIndexLike } from '../adapters/embedding-index/vectorize-index';
import type { ChatChunk } from '../core/entities/chat-chunk';
import chatChunks from '../generated/chat-chunks.json';

/**
 * Runtime env shape POST /api/chat reads bindings/secrets from (spec section 4/8: "config-driven
 * provider selection"). All fields optional by construction — every capability here has a
 * zero-credential dev fallback, selected automatically by presence/absence, mirroring
 * ConsoleEmailSender vs ResendEmailSender in phase 2.
 */
export interface ChatRuntimeEnv {
  AI?: AiBindingLike;
  VECTORIZE?: VectorizeIndexLike;
  ANTHROPIC_API_KEY?: string;
  RATE_LIMIT_KV?: unknown;
}

/**
 * Provider routing config (spec section 8's sketch):
 *   providers: { primary: "workers-ai:llama-3.3-70b", fallbacks: ["workers-ai:mistral-7b"] }
 *   // later: primary: "anthropic:claude-haiku", escalation rules by intent/length
 *
 * To switch primary to Anthropic once `ANTHROPIC_API_KEY` is set in production, flip the ternary
 * below (or make it unconditional) — no other file needs to change.
 */
export function getLlmProvider(env: ChatRuntimeEnv): LlmProvider {
  const anthropic = env.ANTHROPIC_API_KEY ? new AnthropicProvider(env.ANTHROPIC_API_KEY) : undefined;
  const workersAi = env.AI ? new WorkersAiProvider(env.AI) : undefined;
  const echo = new EchoDevProvider();

  // Primary: Workers AI in production (free, spec's $0 default). Anthropic (if a key is present)
  // is tried first as the "quality upgrade" the spec calls out, then Workers AI, then the fully
  // offline Echo provider so the chain always terminates without any credentials.
  const candidates: (LlmProvider | undefined)[] = [anthropic, workersAi, echo];
  const chain = candidates.filter((p): p is LlmProvider => p !== undefined);
  const [primary, ...fallbacks] = chain;
  return new LlmRouter(primary ?? echo, fallbacks);
}

export function getEmbeddingIndex(env: ChatRuntimeEnv): EmbeddingIndex {
  if (env.AI && env.VECTORIZE) {
    return new VectorizeIndex(env.AI, env.VECTORIZE);
  }
  // Dev + v1-production fallback: no network, no embeddings — pure-TS BM25 over the committed
  // chat-chunks.json (see scripts/build-chat-index.ts).
  return new LexicalIndex(chatChunks as ChatChunk[]);
}
