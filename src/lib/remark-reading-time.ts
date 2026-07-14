import { toString } from 'mdast-util-to-string';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { readingTimeFromWordCount } from './reading-time';

/**
 * Computes reading time from the rendered markdown/MDX tree (spec section 5: article.readingTime
 * is "computed"). Writes it onto `astro.frontmatter` so it's available as `remarkPluginFrontmatter`
 * from `render()` without a second word-count pass over the raw body.
 */
export const remarkReadingTime: Plugin<[], Root> = () => (tree, file) => {
  const text = toString(tree);
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const data = file.data as { astro?: { frontmatter?: Record<string, unknown> } };
  if (data.astro?.frontmatter) {
    data.astro.frontmatter.readingTime = readingTimeFromWordCount(words);
  }
};
