import type { APIRoute } from 'astro';
import { contentRepository } from '../../../config/site';
import { speakingToMarkdown } from '../../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /pt/speaking (V3d refinement addendum). Same `speakingToMarkdown` function
 *  the EN twin (src/pages/speaking/index.md.ts) calls, parameterized with 'pt-br'. Talks
 *  themselves aren't locale-specific content (`getTalks()` takes no locale), same as the PT HTML
 *  page's own usage. */
export const GET: APIRoute = async () => {
  const talks = await contentRepository.getTalks();

  return new Response(speakingToMarkdown(talks, 'pt-br'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
