#!/usr/bin/env tsx
/**
 * CLI wrapper for the publish-kit core service (spec sections 9 & 14).
 *
 * Usage: pnpm publish-kit <slug>
 *
 * Reads content/articles/<slug>.mdx, renders it to HTML via Astro's standalone markdown
 * processor (matching site config: GFM + smartypants on), strips the handful of MDX-only
 * component tags (e.g. <Callout>) down to their plain inner content since components can't be
 * evaluated outside the Astro build, and writes the four syndication artifacts to
 * publish-kits/<slug>/ (gitignored — see .gitignore).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createMarkdownProcessor, parseFrontmatter } from '@astrojs/markdown-remark';
import { generatePublishKit, type PublishKitInput } from '../src/core/services/publish-kit';
import { stripMdxComponents } from '../src/core/services/markdown-twin';

// Can't import `siteConfig` from src/config/site.ts here: it pulls in `GitContentRepository`,
// which imports `astro:content` — a virtual module that only resolves inside Astro's own
// build/dev pipeline, not in this standalone tsx script. Duplicated as a literal (matches
// siteConfig.url) rather than restructuring config/site.ts's export shape for one script.
const SITE_URL = 'https://felipetavares.dev';

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: pnpm publish-kit <slug>');
    process.exit(1);
  }

  const articlePath = path.resolve(process.cwd(), 'content/articles', `${slug}.mdx`);
  if (!existsSync(articlePath)) {
    console.error(`Article not found: ${articlePath}`);
    process.exit(1);
  }

  const raw = await readFile(articlePath, 'utf-8');
  const { frontmatter, content } = parseFrontmatter(raw);

  if (frontmatter.draft) {
    console.error(`Refusing to generate a publish kit for a draft article: ${slug}`);
    process.exit(1);
  }

  const cleanedMarkdown = stripMdxComponents(content);

  const processor = await createMarkdownProcessor({ gfm: true, smartypants: true });
  const rendered = await processor.render(cleanedMarkdown);

  const plainText = stripHtmlToPlainText(rendered.code);
  const canonicalUrl = frontmatter.canonicalOverride ?? `${SITE_URL}/writing/${slug}`;

  const input: PublishKitInput = {
    title: frontmatter.title,
    description: frontmatter.description,
    slug,
    pubDate: new Date(frontmatter.pubDate),
    tags: frontmatter.tags ?? [],
    canonicalUrl,
    contentHtml: rendered.code,
    plainText,
  };

  const kit = generatePublishKit(input, SITE_URL);

  const outDir = path.resolve(process.cwd(), 'publish-kits', slug);
  await mkdir(outDir, { recursive: true });

  await Promise.all([
    writeFile(path.join(outDir, 'substack.html'), kit.substackHtml, 'utf-8'),
    writeFile(path.join(outDir, 'linkedin.md'), kit.linkedinPost, 'utf-8'),
    writeFile(path.join(outDir, 'reddit.md'), kit.redditPost, 'utf-8'),
    writeFile(path.join(outDir, 'x-thread.md'), kit.xThread, 'utf-8'),
  ]);

  console.log(`Publish kit written to publish-kits/${slug}/`);
  console.log('  - substack.html');
  console.log('  - linkedin.md');
  console.log('  - reddit.md');
  console.log('  - x-thread.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
