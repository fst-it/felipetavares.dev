import type { APIRoute } from 'astro';
import { contentRepository } from '../../../config/site';
import { writingListingToMarkdown } from '../../../core/services/markdown-twin';

export const prerender = true;

/**
 * Markdown twin of /pt/writing (V3d refinement addendum). The EN /writing listing has no twin of
 * its own (only individual /writing/[slug] pages do) — this is the first listing twin, generated
 * by `writingListingToMarkdown` in markdown-twin.ts. Articles themselves stay EN-only content
 * (V3d addendum decision, same as the PT HTML page: PT chrome, EN-titled cards).
 */
export const GET: APIRoute = async () => {
  const articles = await contentRepository.getArticles();

  return new Response(writingListingToMarkdown(articles, 'pt-br'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
