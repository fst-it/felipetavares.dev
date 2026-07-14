import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { contentRepository } from '../../config/site';
import { projectToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /projects/[slug] (V3b addendum commit 2). */
export async function getStaticPaths() {
  const entries = await getCollection('projects');
  return entries.map((entry) => ({ params: { slug: entry.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const entry = await getEntry('projects', params.slug!);
  if (!entry) return new Response('Not found', { status: 404 });

  const project = (await contentRepository.getProject(params.slug!))!;
  const markdown = projectToMarkdown(project, entry.body ?? '');

  return new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
