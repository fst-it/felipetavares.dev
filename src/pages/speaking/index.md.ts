import type { APIRoute } from 'astro';
import { contentRepository } from '../../config/site';
import { speakingToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /speaking (V3b addendum commit 2). */
export const GET: APIRoute = async () => {
  const talks = await contentRepository.getTalks();

  return new Response(speakingToMarkdown(talks), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
