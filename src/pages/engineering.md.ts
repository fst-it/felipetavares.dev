import type { APIRoute } from 'astro';
import { contentRepository } from '../config/site';
import { engineeringHubToMarkdown } from '../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /engineering (AI-ready exposure follow-on). EN-only — mirrors the HTML page,
 *  which has no PT sibling (the engineering collection is EN-only; see content.config.ts). */
export const GET: APIRoute = async () => {
  const hub = await contentRepository.getEngineeringHub();

  return new Response(engineeringHubToMarkdown(hub), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
