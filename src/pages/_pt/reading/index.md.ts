import type { APIRoute } from 'astro';
import { contentRepository } from '../../../config/site';
import { readingListingToMarkdown } from '../../../core/services/markdown-twin';

export const prerender = true;

/**
 * Markdown twin of /pt/reading. Reviews stay EN-only in v1 (same decision as articles/projects).
 * The PT locale twin uses 'pt-br' section headings with EN review entries — mirrors the pattern
 * used by /pt/writing/index.md and /pt/projects/index.md.
 */
export const GET: APIRoute = async () => {
  const readings = await contentRepository.getReadings();

  return new Response(readingListingToMarkdown(readings, 'pt-br'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
