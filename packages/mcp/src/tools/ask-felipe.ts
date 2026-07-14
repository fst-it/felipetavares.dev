/**
 * `ask_felipe` — the one MCP tool that calls an LLM, routing through the exact same
 * src/core/services/chat-service.ts + adapters/llm/* path POST /api/chat uses (ADR 0001:
 * deterministic-first, the chatbot is the only sanctioned LLM call surface — this tool extends
 * that surface rather than adding a second one). Retrieval reuses the same LexicalIndex +
 * chat-chunks.json `search_content` reads; the grounded system prompt, abuse-phrase pre-filter,
 * and don't-know fallback are all imported unchanged from chat-service.ts (single definition).
 *
 * Unlike /api/chat, this tool has no streaming transport (an MCP tool call returns one result) —
 * the LlmProvider's AsyncIterable<string> is drained into a single string before returning.
 */
import { z } from 'zod';
import {
  buildChatPrompt,
  containsAbusePhrase,
  dedupeSources,
  DONT_KNOW_FALLBACK,
  MAX_OUTPUT_TOKENS,
} from '../../../../src/core/services/chat-service';
import { LexicalIndex } from '../../../../src/adapters/embedding-index/lexical-index';
import type { ChatChunk } from '../../../../src/core/entities/chat-chunk';
import chatChunks from '../../../../src/generated/chat-chunks.json' with { type: 'json' };
import { getLlmProvider, type McpEnv } from '../config';

const TOP_K = 6;

export const askFelipeInputSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe("A question about Felipe's work, experience, or projects, 1-1000 characters."),
  })
  .strict();

export type AskFelipeInput = z.infer<typeof askFelipeInputSchema>;

export interface AskFelipeResult {
  answer: string;
  sources: { url: string; title: string }[];
}

let index: LexicalIndex | undefined;
function getIndex(): LexicalIndex {
  if (!index) index = new LexicalIndex(chatChunks as ChatChunk[]);
  return index;
}

export async function askFelipe(input: AskFelipeInput, env: McpEnv): Promise<AskFelipeResult> {
  if (containsAbusePhrase(input.question)) {
    return { answer: "I can't help with that. Try asking about Felipe's work or experience.", sources: [] };
  }

  const chunks = await getIndex().retrieve(input.question, TOP_K);
  const promptMessages = buildChatPrompt({ history: [], question: input.question, chunks });
  const sources = dedupeSources(chunks);

  const llm = getLlmProvider(env);
  let answer = '';
  try {
    for await (const delta of llm.complete(promptMessages, { maxTokens: MAX_OUTPUT_TOKENS })) {
      answer += delta;
    }
  } catch (error) {
    console.error('[ask_felipe] LLM call failed:', error instanceof Error ? error.message : error);
    return { answer: DONT_KNOW_FALLBACK, sources: [] };
  }

  if (!answer.trim()) {
    return { answer: DONT_KNOW_FALLBACK, sources: [] };
  }

  return { answer: answer.trim(), sources };
}

export const askFelipeToolDefinition = {
  title: 'Ask Felipe',
  description:
    "Asks a natural-language question about Felipe Tavares — his work, experience, projects, or " +
    'positioning — and gets back a grounded answer generated from the same retrieval-augmented ' +
    'chatbot that powers the "Ask Felipe\'s AI" widget on felipetavares.dev. Rate-limited (10/hr ' +
    'per caller); prefer `search_content` or `get_page` for direct lookups when a natural-language ' +
    'answer isn\'t needed — this is the only tool in this server that calls an LLM. Returns ' +
    '`{answer, sources}` where `sources` lists the site pages the answer drew from. Example: ' +
    '`{"question": "What is Selfwright and why did Felipe build it?"}`.',
  inputSchema: askFelipeInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};
