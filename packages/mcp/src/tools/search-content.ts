/**
 * `search_content` — deterministic tool, zero LLM. Lexical (BM25-style) search over the same
 * committed chat-chunks.json the chatbot's dev/v1-prod `LexicalIndex` adapter reads — no second
 * search implementation, no embeddings, matching ADR 0001 (deterministic-first).
 */
import { z } from 'zod';
import { LexicalIndex } from '../../../../src/adapters/embedding-index/lexical-index';
import type { ChatChunk } from '../../../../src/core/entities/chat-chunk';
import chatChunks from '../../../../src/generated/chat-chunks.json' with { type: 'json' };

const MAX_LIMIT = 10;

export const searchContentInputSchema = z
  .object({
    query: z.string().trim().min(1).max(200).describe('Free-text search query, 1-200 characters.'),
    limit: z.number().int().min(1).max(MAX_LIMIT).default(5).describe(`Max results to return (1-${MAX_LIMIT}).`),
  })
  .strict();

export type SearchContentInput = z.infer<typeof searchContentInputSchema>;

let index: LexicalIndex | undefined;
function getIndex(): LexicalIndex {
  if (!index) index = new LexicalIndex(chatChunks as ChatChunk[]);
  return index;
}

export interface SearchContentResult {
  url: string;
  title: string;
  type: string;
  score: number;
  /** Short excerpt, not the full chunk text — keeps responses small (spec: outputs size-capped). */
  excerpt: string;
}

const EXCERPT_WORDS = 60;

function toExcerpt(text: string): string {
  const words = text.trim().split(/\s+/);
  const excerpt = words.slice(0, EXCERPT_WORDS).join(' ');
  return words.length > EXCERPT_WORDS ? `${excerpt}…` : excerpt;
}

export async function searchContent(input: SearchContentInput): Promise<SearchContentResult[]> {
  const matches = await getIndex().retrieve(input.query, input.limit);
  return matches.map((m) => ({
    url: m.url,
    title: m.title,
    type: m.type,
    score: Math.round(m.score * 1000) / 1000,
    excerpt: toExcerpt(m.text),
  }));
}

export const searchContentToolDefinition = {
  title: 'Search Content',
  description:
    "Full-text search over every published page on felipetavares.dev — articles, projects, " +
    'roles, talks, and site copy — using the same lexical (BM25) index behind the site chatbot. ' +
    'No embeddings, no LLM call: deterministic, same query always returns the same ranking. ' +
    'Returns up to `limit` scored matches, each with a url, title, content type, relevance score, ' +
    'and a short excerpt (not the full text — call `get_page` with the returned url for that). ' +
    'Example: `{"query": "selfwright architecture", "limit": 5}`.',
  inputSchema: searchContentInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
