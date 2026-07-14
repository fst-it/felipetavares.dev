const WORDS_PER_MINUTE = 200;

/**
 * Single formula for reading time (spec section 5: article.readingTime is "computed"): count
 * words, divide by 200 wpm, round, floor at 1 minute. Shared by the remark plugin (exact word
 * count from the rendered MDX tree) and the content-repository estimate (raw body text) — both
 * feed the same formula, they just count words from different sources.
 */
export function readingTimeFromWordCount(wordCount: number): string {
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}
