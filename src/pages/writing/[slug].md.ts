import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { contentRepository } from '../../config/site';
import { articleToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/**
 * Markdown twin of /writing/[slug] (V3b addendum commit 2). Same redacted content the HTML page
 * reads — `articleToMarkdown` strips MDX component tags from the raw entry body, no second copy
 * of the content exists.
 */
export async function getStaticPaths() {
  const entries = await getCollection('articles', ({ data }) => !data.draft);
  return entries.map((entry) => ({ params: { slug: entry.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const entry = await getEntry('articles', params.slug!);
  if (!entry) return new Response('Not found', { status: 404 });

  const article = (await contentRepository.getArticle(params.slug!))!;
  const markdown = articleToMarkdown(article, entry.body ?? '');

  return new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
