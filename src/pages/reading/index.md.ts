import type { APIRoute } from 'astro';
import { contentRepository } from '../../config/site';
import { readingListingToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/**
 * Markdown twin of /reading. Reviews are EN-only in v1; this twin renders the listing in EN.
 * With zero reviews, renders a sensible stub (title + empty-state line) per the
 * graceful-absence contract shared by talks/testimonials/projects.
 */
export const GET: APIRoute = async () => {
  const readings = await contentRepository.getReadings();

  return new Response(readingListingToMarkdown(readings, 'en'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
