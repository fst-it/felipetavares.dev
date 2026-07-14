import type { ChatChunk } from '../entities/chat-chunk';

const TARGET_CHUNK_WORDS = 500;

export interface ChunkSource {
  url: string;
  title: string;
  type: ChatChunk['type'];
  /** Plain text (markdown/HTML stripped) — heading lines still start with `#`. */
  text: string;
}

/**
 * Splits markdown-ish plain text into heading-aware ~500-word chunks (spec section 8's
 * "heading-aware, ~500-token chunks"; word count is used as the token proxy — good enough for
 * BM25-style lexical retrieval and cheap to compute deterministically without a tokenizer dep).
 *
 * Algorithm: walk lines, track the most recent heading, accumulate paragraphs into the current
 * chunk until it would exceed the target size, then flush. A heading always starts a new chunk
 * (never split a heading from what immediately follows it) so citations stay coherent.
 */
export function chunkText(source: ChunkSource): ChatChunk[] {
  const lines = source.text.split('\n');
  const chunks: ChatChunk[] = [];

  // Build a source-discriminator from url + title so chunks from different sources that share a
  // URL (e.g. all role pages point to /experience, and site pages point to /) get globally unique,
  // stable ids. The title slug is capped at 40 chars to keep ids readable.
  const titleSlug = source.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '')
    .slice(0, 40);
  const sourceKey = `${source.url}#${titleSlug}`;

  let currentHeading: string | undefined;
  let buffer: string[] = [];
  let bufferWords = 0;

  function flush() {
    const text = buffer.join('\n').trim();
    if (text) {
      chunks.push({
        id: `${sourceKey}-${chunks.length}`,
        url: source.url,
        title: source.title,
        type: source.type,
        heading: currentHeading,
        text,
      });
    }
    buffer = [];
    bufferWords = 0;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
      buffer.push(line);
      bufferWords += headingMatch[2].trim().split(/\s+/).filter(Boolean).length;
      continue;
    }

    const lineWords = line.trim().split(/\s+/).filter(Boolean).length;
    if (bufferWords > 0 && bufferWords + lineWords > TARGET_CHUNK_WORDS) {
      flush();
      // A fresh chunk under the same heading still carries that heading for context.
    }

    buffer.push(line);
    bufferWords += lineWords;
  }

  flush();
  return chunks;
}
