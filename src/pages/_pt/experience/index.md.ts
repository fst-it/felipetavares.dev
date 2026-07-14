import type { APIRoute } from 'astro';
import { contentRepository } from '../../../config/site';
import { experienceToMarkdown } from '../../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /pt/experience (V3d refinement addendum). Same `experienceToMarkdown`
 *  function the EN twin (src/pages/experience/index.md.ts) calls, parameterized with 'pt-br'. */
export const GET: APIRoute = async () => {
  const positioning = await contentRepository.getPositioning('pt-br');
  const roles = await contentRepository.getRoles('pt-br');

  return new Response(experienceToMarkdown(positioning, roles, 'pt-br'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
