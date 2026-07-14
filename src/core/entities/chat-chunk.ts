/** A single retrievable unit produced by scripts/build-chat-index.ts. */
export interface ChatChunk {
  /** Stable id: `${url}#${titleSlug}-${chunkIndex}` — globally unique across sources that share a
   *  URL (e.g. multiple roles at /experience). Used for dedup and Vectorize vector IDs. */
  id: string;
  url: string;
  title: string;
  type: 'article' | 'project' | 'role' | 'talk' | 'site';
  /** Nearest heading above this chunk, if any — helps the model cite precisely. */
  heading?: string;
  text: string;
}
