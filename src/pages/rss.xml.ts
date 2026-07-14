import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import mdxRenderer from '@astrojs/mdx/server.js';
import { getCollection, render } from 'astro:content';
import { contentRepository, siteConfig } from '../config/site';

/**
 * Full-content RSS feed (spec sections 9/10) — required for Dev.to/Hashnode's RSS-import
 * syndication path, which needs the complete rendered HTML, not just a summary.
 *
 * Article ordering/filtering (exclude drafts, newest first) comes from
 * `contentRepository.getArticles()` — the same source every other page uses — rather than
 * re-deriving it here. Raw `getCollection`/`render` are still needed for the one thing the
 * `ContentRepository` port doesn't expose: rendered MDX HTML. MDX entries (unlike plain .md) never
 * populate `entry.rendered.html` — Astro compiles MDX to an importable component (`Content`)
 * rather than a pre-rendered HTML string, so `render(entry)` is the only way to get one. The
 * Container API renders that component to a string outside of a page request, which is exactly
 * what's needed here since this is a prerendered build-time route.
 */
export async function GET(context: APIContext) {
  const [articles, rawEntries] = await Promise.all([
    contentRepository.getArticles(),
    getCollection('articles'),
  ]);
  const rawBySlug = new Map(rawEntries.map((entry) => [entry.id, entry]));

  const container = await AstroContainer.create();
  container.addServerRenderer({ name: '@astrojs/mdx', renderer: mdxRenderer });
  const items = await Promise.all(
    articles.map(async (article) => {
      const entry = rawBySlug.get(article.slug)!;
      const { Content } = await render(entry);
      const contentHtml = await container.renderToString(Content);
      return {
        title: article.title,
        description: article.description,
        pubDate: article.pubDate,
        link: `/writing/${article.slug}/`,
        categories: article.tags,
        content: contentHtml,
      };
    })
  );

  return rss({
    title: `${siteConfig.name} — Writing`,
    description: siteConfig.defaultDescription,
    site: context.site ?? siteConfig.url,
    items,
    customData: `<language>en-us</language>`,
  });
}
