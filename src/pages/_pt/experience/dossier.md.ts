import type { APIRoute } from 'astro';
import { contentRepository } from '../../../config/site';
import { dossierToMarkdown } from '../../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /pt/experience/dossier (V3d refinement addendum). Same `dossierToMarkdown`
 *  function the EN twin (src/pages/experience/dossier.md.ts) calls, parameterized with 'pt-br'. */
export const GET: APIRoute = async () => {
  const dossier = await contentRepository.getDossier('pt-br');
  const roles = await contentRepository.getRoles('pt-br');

  return new Response(dossierToMarkdown(dossier, roles, 'pt-br'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
