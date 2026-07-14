/**
 * `list_articles` — deterministic tool, zero LLM. Metadata listing (slug, title, description,
 * tags, dates) for every published article — drafts are already excluded by `loadArticles()`.
 */
import { z } from 'zod';
import { loadArticles } from '../content-loader';

export const listArticlesInputSchema = z.object({}).strict();

export interface ArticleListing {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  tags: string[];
  readingTime?: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function listArticles(): Promise<ArticleListing[]> {
  const articles = await loadArticles();
  return articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    pubDate: isoDate(a.pubDate),
    updatedDate: a.updatedDate ? isoDate(a.updatedDate) : undefined,
    tags: a.tags,
    readingTime: a.readingTime,
  }));
}

export const listArticlesToolDefinition = {
  title: 'List Articles',
  description:
    'Lists every published article on felipetavares.dev, most recent first (slug, title, ' +
    'description, tags, publish/update dates, reading time). Draft articles are never included. ' +
    'Does not include full article content — pass a returned `slug` as `/writing/<slug>` to ' +
    '`get_page` for that. Use this to discover valid article slugs before calling `get_page`.',
  inputSchema: listArticlesInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
