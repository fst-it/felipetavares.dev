#!/usr/bin/env tsx
/**
 * Chat retrieval index builder (spec sections 8 & 14).
 *
 * Usage:
 *   pnpm build-chat-index            builds src/generated/chat-chunks.json (committed, deterministic)
 *   pnpm build-chat-index --upsert   also embeds+upserts every chunk into Cloudflare Vectorize
 *                                    (index `fst-chat`) via wrangler — deployment-time only, skips
 *                                    gracefully if wrangler / Cloudflare auth isn't available.
 *
 * Reads all published content directly off disk (articles/projects MDX, roles/talks JSON, the
 * site singleton) the same way scripts/publish-kit.ts does — no Astro content-collections runtime
 * needed for a standalone script — strips MDX-only component tags via the shared
 * `stripMdxComponents` (src/core/services/markdown-twin.ts) and frontmatter, then chunks each
 * source into heading-aware ~500-word pieces via core/services/chunker.ts.
 *
 * The output JSON is committed so `LexicalIndex` (dev + v1 prod fallback) works with zero build
 * step at runtime; it's also the input the `--upsert` pass embeds into Vectorize for the
 * production `VectorizeIndex` adapter.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { chunkText } from '../src/core/services/chunker';
import { stripMdxComponents } from '../src/core/services/markdown-twin';
import type { ChatChunk } from '../src/core/entities/chat-chunk';

const CONTENT_DIR = path.resolve(process.cwd(), 'content');
const OUT_PATH = path.resolve(process.cwd(), 'src/generated/chat-chunks.json');

async function listFiles(dir: string, ext: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith(ext)).map((f) => path.join(dir, f));
}

async function chunksFromArticles(): Promise<ChatChunk[]> {
  const files = await listFiles(path.join(CONTENT_DIR, 'articles'), '.mdx');
  const chunks: ChatChunk[] = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    const { frontmatter, content } = parseFrontmatter(raw);
    if (frontmatter.draft) continue;

    const slug = path.basename(file, '.mdx');
    chunks.push(
      ...chunkText({
        url: `/writing/${slug}`,
        title: frontmatter.title,
        type: 'article',
        text: stripMdxComponents(content),
      })
    );
  }
  return chunks;
}

async function chunksFromProjects(): Promise<ChatChunk[]> {
  const files = await listFiles(path.join(CONTENT_DIR, 'projects'), '.mdx');
  const chunks: ChatChunk[] = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    const { frontmatter, content } = parseFrontmatter(raw);

    const slug = path.basename(file, '.mdx');
    const intro = `${frontmatter.title} — ${frontmatter.tagline}\n\n${content}`;
    chunks.push(
      ...chunkText({
        url: `/projects/${slug}`,
        title: frontmatter.title,
        type: 'project',
        text: stripMdxComponents(intro),
      })
    );
  }
  return chunks;
}

async function chunksFromRoles(): Promise<ChatChunk[]> {
  const files = await listFiles(path.join(CONTENT_DIR, 'roles'), '.json');
  const chunks: ChatChunk[] = [];

  for (const file of files) {
    const data = JSON.parse(await readFile(file, 'utf-8'));
    const text = [
      `## ${data.title} at ${data.org}`,
      `${data.start} – ${data.end ?? 'present'}, ${data.location}`,
      `Arc: ${data.arc}`,
      '',
      ...(data.impact ?? []).map((i: { metric: string; narrative: string }) => `- ${i.metric}: ${i.narrative}`),
      '',
      `Domains: ${(data.domains ?? []).join(', ')}`,
    ].join('\n');

    chunks.push(
      ...chunkText({
        url: '/experience',
        title: `${data.title} at ${data.org}`,
        type: 'role',
        text,
      })
    );
  }
  return chunks;
}

async function chunksFromTalks(): Promise<ChatChunk[]> {
  const files = await listFiles(path.join(CONTENT_DIR, 'talks'), '.json');
  const chunks: ChatChunk[] = [];

  for (const file of files) {
    const data = JSON.parse(await readFile(file, 'utf-8'));
    const text = [`## ${data.title}`, `${data.event}, ${data.date} (${data.type})`, '', data.abstract].join('\n');

    chunks.push(
      ...chunkText({
        url: '/speaking',
        title: data.title,
        type: 'talk',
        text,
      })
    );
  }
  return chunks;
}

async function chunksFromSite(): Promise<ChatChunk[]> {
  const sitePath = path.join(CONTENT_DIR, 'site', 'site.json');
  if (!existsSync(sitePath)) return [];

  const { site } = JSON.parse(await readFile(sitePath, 'utf-8'));
  const chunks: ChatChunk[] = [];

  chunks.push(
    ...chunkText({
      url: '/',
      title: 'Positioning',
      type: 'site',
      text: `## Positioning\n${site.positioning.statement}`,
    })
  );

  const domainsText = (site.skillDomains ?? [])
    .map((d: { name: string; blurb: string }) => `### ${d.name}\n${d.blurb}`)
    .join('\n\n');
  chunks.push(
    ...chunkText({
      url: '/',
      title: 'Skill domains',
      type: 'site',
      text: `## Skill domains\n${domainsText}`,
    })
  );

  const dossier = site.dossier;
  if (dossier) {
    const dossierText = [
      `## Dossier summary\n${dossier.summary}`,
      '',
      '## Competency matrix',
      ...dossier.competencyMatrix.map(
        (c: { domain: string; depth: number; evidence: string }) =>
          `- ${c.domain} (depth ${c.depth}/5): ${c.evidence}`
      ),
      '',
      '## Education & certifications',
      ...dossier.education.map((e: { degree: string; school: string }) => `- ${e.degree}, ${e.school}`),
      ...dossier.certifications.map((c: string) => `- ${c}`),
    ].join('\n');

    chunks.push(
      ...chunkText({
        url: '/experience/dossier',
        title: 'Executive dossier',
        type: 'site',
        text: dossierText,
      })
    );
  }

  return chunks;
}

async function chunksFromReading(): Promise<ChatChunk[]> {
  const files = await listFiles(path.join(CONTENT_DIR, 'reading'), '.mdx');
  const chunks: ChatChunk[] = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    const { frontmatter, content } = parseFrontmatter(raw);

    const text = [
      `## ${frontmatter.title} — ${frontmatter.author} (${frontmatter.type}, ${frontmatter.dateRead})`,
      '',
      `Verdict [${frontmatter.verdict}]: ${frontmatter.verdictLine}`,
      '',
      'Ideas worth stealing:',
      ...(Array.isArray(frontmatter.ideasWorthStealing) ? frontmatter.ideasWorthStealing.map((i: string) => `- ${i}`) : []),
      '',
      'Watch-outs:',
      ...(Array.isArray(frontmatter.watchOuts) ? frontmatter.watchOuts.map((w: string) => `- ${w}`) : []),
      '',
      `Who should read: ${frontmatter.whoShouldRead}`,
      '',
      stripMdxComponents(content),
    ].join('\n');

    chunks.push(
      ...chunkText({
        url: `/reading`,
        title: `${frontmatter.title} — ${frontmatter.author}`,
        type: 'site',
        text,
      })
    );
  }
  return chunks;
}

async function chunksFromEngineering(): Promise<ChatChunk[]> {
  const enginPath = path.join(CONTENT_DIR, 'engineering.json');
  if (!existsSync(enginPath)) return [];

  const { engineering } = JSON.parse(await readFile(enginPath, 'utf-8'));
  const chunks: ChatChunk[] = [];

  const decisionsText = (engineering.decisions ?? [])
    .map(
      (d: { title: string; context: string; decision: string; cost: string }) =>
        `### ${d.title}\n${d.context} ${d.decision} ${d.cost}`
    )
    .join('\n\n');
  chunks.push(
    ...chunkText({
      url: '/engineering',
      title: 'Engineering decisions',
      type: 'site',
      text: `## Decisions\n${decisionsText}`,
    })
  );

  const stackText = (engineering.stack ?? [])
    .map((s: { name: string; reason: string }) => `- ${s.name}: ${s.reason}`)
    .join('\n');
  chunks.push(
    ...chunkText({
      url: '/engineering',
      title: 'Why this stack',
      type: 'site',
      text: `## Why this stack\n${stackText}`,
    })
  );

  const changelogText = (engineering.changelog ?? [])
    .map((c: { date: string; title: string; detail: string }) => `- ${c.date} — ${c.title}: ${c.detail}`)
    .join('\n');
  chunks.push(
    ...chunkText({
      url: '/engineering',
      title: 'Engineering changelog',
      type: 'site',
      text: `## Changelog\n${changelogText}`,
    })
  );

  return chunks;
}

async function buildChunks(): Promise<ChatChunk[]> {
  const [articles, projects, roles, talks, site, engineering, reading] = await Promise.all([
    chunksFromArticles(),
    chunksFromProjects(),
    chunksFromRoles(),
    chunksFromTalks(),
    chunksFromSite(),
    chunksFromEngineering(),
    chunksFromReading(),
  ]);
  return [...site, ...articles, ...projects, ...roles, ...talks, ...engineering, ...reading];
}

/**
 * Deployment-time only: embeds every chunk via Workers AI and upserts into Vectorize using
 * `wrangler vectorize insert`. Requires wrangler to be authenticated against a real Cloudflare
 * account; skips gracefully (with a clear message) when that's not available, which is always
 * true in Felipe's current no-Cloudflare-account local setup. See docs/chatbot.md for the
 * step-by-step activation sequence.
 */
async function upsertToVectorize(chunks: ChatChunk[]): Promise<void> {
  const { spawnSync } = await import('node:child_process');

  const check = spawnSync('wrangler', ['--version'], { shell: true, encoding: 'utf-8' });
  if (check.status !== 0) {
    console.log(
      '[build-chat-index] --upsert requested but `wrangler` is not available/authenticated — ' +
        'skipping the Vectorize upsert. This is expected until Cloudflare is activated at ' +
        'deployment (see docs/chatbot.md).'
    );
    return;
  }

  const ndjsonPath = path.resolve(process.cwd(), 'src/generated/chat-chunks.upsert.ndjson');
  const lines = chunks.map((chunk, i) =>
    JSON.stringify({
      id: chunk.id || `chunk-${i}`,
      metadata: { url: chunk.url, title: chunk.title, type: chunk.type, text: chunk.text },
    })
  );
  await writeFile(ndjsonPath, lines.join('\n'), 'utf-8');

  console.log(
    `[build-chat-index] Wrote ${ndjsonPath}. Embedding + inserting into Vectorize index ` +
      '"fst-chat" requires running the embed step inside a Worker (Workers AI binding isn\'t ' +
      'reachable from a local Node script) — see docs/chatbot.md for the exact ' +
      '`wrangler vectorize insert` deployment sequence.'
  );
}

async function main() {
  const chunks = await buildChunks();

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(chunks, null, 2) + '\n', 'utf-8');
  console.log(`[build-chat-index] Wrote ${chunks.length} chunks to ${path.relative(process.cwd(), OUT_PATH)}`);

  if (process.argv.includes('--upsert')) {
    await upsertToVectorize(chunks);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
