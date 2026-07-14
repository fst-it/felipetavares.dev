export interface EmbeddingMatch {
  url: string;
  title: string;
  type: string;
  score: number;
  text: string;
}

/**
 * Backs the chatbot's retrieval step (spec section 8). `retrieve` is the port pages/services
 * call: text query in, ranked matches out. Implementations decide internally how to get there —
 * `LexicalIndex` (dev + v1 prod fallback) scores in pure TS with no network call; `VectorizeIndex`
 * (production) embeds the query via Workers AI then queries Cloudflare Vectorize. Keeping `embed`
 * + `query` as the lower-level primitives lets a real vector-backed adapter expose them for the
 * build-time upsert script, while `retrieve` stays the one method `chat-service` depends on.
 */
export interface EmbeddingIndex {
  retrieve(query: string, topK: number): Promise<EmbeddingMatch[]>;
}
