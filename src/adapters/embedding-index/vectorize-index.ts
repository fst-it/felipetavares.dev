import type { EmbeddingIndex, EmbeddingMatch } from '../../core/ports/embedding-index';
import type { AiBindingLike } from '../llm/workers-ai';

/** Minimal shape of the Cloudflare Vectorize binding this adapter needs. */
export interface VectorizeIndexLike {
  query(
    vector: number[],
    opts: { topK: number; returnMetadata?: boolean | 'all' }
  ): Promise<{ matches: { score: number; metadata?: Record<string, unknown> }[] }>;
  upsert(
    vectors: { id: string; values: number[]; metadata: Record<string, unknown> }[]
  ): Promise<unknown>;
}

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Production EmbeddingIndex adapter (spec section 8/14) — embeds the query via Workers AI
 * (bge-base-en-v1.5) then queries Cloudflare Vectorize (index name `fst-chat`, see
 * wrangler.jsonc). Only ever constructed when both `env.AI` and `env.VECTORIZE` bindings are
 * present (see src/config/llm.ts's `getEmbeddingIndex`); everywhere else (local dev, until Felipe
 * activates Cloudflare) `LexicalIndex` is used instead.
 *
 * The build-time upsert (chunk -> embedding -> Vectorize.upsert) is a separate concern handled by
 * `scripts/build-chat-index.ts --upsert`, which requires `wrangler` and runs at deployment time —
 * this class only queries, it never writes vectors on a request path.
 */
export class VectorizeIndex implements EmbeddingIndex {
  constructor(
    private readonly ai: AiBindingLike,
    private readonly vectorize: VectorizeIndexLike
  ) {}

  async retrieve(query: string, topK: number): Promise<EmbeddingMatch[]> {
    const embedded = await this.ai.run(EMBEDDING_MODEL, { text: [query] });
    const vector = embedded.data[0];
    if (!vector) return [];

    const result = await this.vectorize.query(vector, { topK, returnMetadata: 'all' });

    return result.matches.map((match): EmbeddingMatch => {
      const metadata = match.metadata ?? {};
      return {
        url: (metadata.url as string) ?? '',
        title: (metadata.title as string) ?? '',
        type: (metadata.type as string) ?? '',
        score: match.score,
        text: (metadata.text as string) ?? '',
      };
    });
  }
}
