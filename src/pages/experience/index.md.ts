import type { APIRoute } from 'astro';
import { contentRepository } from '../../config/site';
import { experienceToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /experience (V3b addendum commit 2). V5a fix 3a: mirrors the HTML page's
 *  latest-first order (no `.reverse()`) so the two stay in sync. */
export const GET: APIRoute = async () => {
  const positioning = await contentRepository.getPositioning();
  const roles = await contentRepository.getRoles();

  return new Response(experienceToMarkdown(positioning, roles), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
