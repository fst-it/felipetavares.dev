import type { APIRoute } from 'astro';
import { contentRepository } from '../../config/site';
import { dossierToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /experience/dossier (V3b addendum commit 2). */
export const GET: APIRoute = async () => {
  const dossier = await contentRepository.getDossier();
  const roles = await contentRepository.getRoles();

  return new Response(dossierToMarkdown(dossier, roles), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
