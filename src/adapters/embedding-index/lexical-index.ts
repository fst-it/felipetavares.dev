import type { EmbeddingIndex, EmbeddingMatch } from '../../core/ports/embedding-index';
import type { ChatChunk } from '../../core/entities/chat-chunk';

const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

interface IndexedDoc {
  chunk: ChatChunk;
  tokens: string[];
  termFreq: Map<string, number>;
  length: number;
}

/**
 * Dev + v1-production EmbeddingIndex adapter (spec section 8/14): a pure-TS BM25-style lexical
 * scorer over the pre-built chat-chunks.json. No network call, no embedding model, fully
 * unit-testable — this is what runs whenever `env.AI`/`env.VECTORIZE` aren't bound (i.e. always,
 * until Felipe activates Cloudflare bindings at deployment; see docs/chatbot.md).
 */
export class LexicalIndex implements EmbeddingIndex {
  private docs: IndexedDoc[];
  private docFreq = new Map<string, number>();
  private avgLength = 0;

  constructor(chunks: ChatChunk[]) {
    this.docs = chunks.map((chunk) => {
      const tokens = tokenize(chunk.text);
      const termFreq = new Map<string, number>();
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      }
      return { chunk, tokens, termFreq, length: tokens.length };
    });

    for (const doc of this.docs) {
      for (const term of doc.termFreq.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }

    const totalLength = this.docs.reduce((sum, doc) => sum + doc.length, 0);
    this.avgLength = this.docs.length > 0 ? totalLength / this.docs.length : 0;
  }

  async retrieve(query: string, topK: number): Promise<EmbeddingMatch[]> {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0 || this.docs.length === 0) return [];

    const n = this.docs.length;

    const scored = this.docs.map((doc) => {
      let score = 0;
      for (const term of queryTerms) {
        const df = this.docFreq.get(term);
        if (!df) continue;
        const tf = doc.termFreq.get(term) ?? 0;
        if (tf === 0) continue;

        const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1);
        const denom = tf + K1 * (1 - B + (B * doc.length) / (this.avgLength || 1));
        score += idf * ((tf * (K1 + 1)) / denom);
      }
      return { doc, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(
        ({ doc, score }): EmbeddingMatch => ({
          url: doc.chunk.url,
          title: doc.chunk.title,
          type: doc.chunk.type,
          score,
          text: doc.chunk.text,
        })
      );
  }
}
