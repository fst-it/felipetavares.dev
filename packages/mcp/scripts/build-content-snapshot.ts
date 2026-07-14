#!/usr/bin/env tsx
/**
 * Content snapshot builder (MCP commit 3) — mirrors scripts/build-chat-index.ts's exact pattern
 * one level up: read content/ off disk (no astro:content, same real constraint), write one
 * committed, deterministic JSON file.
 *
 * Why this exists: content-loader.ts originally read content/ directly via node:fs at request
 * time, which works for the stdio transport (a real Node process) but not the Cloudflare Worker
 * transport (commit 3) — Workers have no filesystem. Rather than maintaining two separate
 * content-reading code paths (one per transport), this script produces one static snapshot both
 * transports read identically, exactly the same shape src/generated/chat-chunks.json already uses
 * for search. Run whenever content/ changes:
 *
 *   pnpm --filter felipetavares-mcp build-content-snapshot
 *
 * Output: packages/mcp/src/generated/content-snapshot.json (committed, deterministic — same
 * snapshot in, same snapshot out).
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const CONTENT_DIR = path.join(REPO_ROOT, 'content');
const OUT_PATH = path.resolve(import.meta.dirname, '../src/generated/content-snapshot.json');

async function listFiles(dir: string, ext: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith(ext)).sort();
}

async function buildArticles() {
  const files = await listFiles(path.join(CONTENT_DIR, 'articles'), '.mdx');
  const articles = [];
  for (const file of files) {
    const raw = await readFile(path.join(CONTENT_DIR, 'articles', file), 'utf-8');
    const { frontmatter, content } = parseFrontmatter(raw);
    if (frontmatter.draft) continue;
    articles.push({ slug: path.basename(file, '.mdx'), frontmatter, body: content });
  }
  return articles;
}

async function buildProjects() {
  const files = await listFiles(path.join(CONTENT_DIR, 'projects'), '.mdx');
  const projects = [];
  for (const file of files) {
    const raw = await readFile(path.join(CONTENT_DIR, 'projects', file), 'utf-8');
    const { frontmatter, content } = parseFrontmatter(raw);
    projects.push({ slug: path.basename(file, '.mdx'), frontmatter, body: content });
  }
  return projects;
}

async function buildRoles() {
  const files = await listFiles(path.join(CONTENT_DIR, 'roles'), '.json');
  const roles = [];
  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(CONTENT_DIR, 'roles', file), 'utf-8'));
    roles.push({ slug: path.basename(file, '.json'), ...data });
  }
  return roles;
}

async function buildTalks() {
  const files = await listFiles(path.join(CONTENT_DIR, 'talks'), '.json');
  const talks = [];
  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(CONTENT_DIR, 'talks', file), 'utf-8'));
    talks.push({ slug: path.basename(file, '.json'), ...data });
  }
  return talks;
}

async function buildSite() {
  const sitePath = path.join(CONTENT_DIR, 'site', 'site.json');
  const { site } = JSON.parse(await readFile(sitePath, 'utf-8'));
  return site;
}

async function buildEngineering() {
  const enginPath = path.join(CONTENT_DIR, 'engineering.json');
  const { engineering } = JSON.parse(await readFile(enginPath, 'utf-8'));
  return engineering;
}

async function buildReading() {
  const files = await listFiles(path.join(CONTENT_DIR, 'reading'), '.mdx');
  const readings = [];
  for (const file of files) {
    const raw = await readFile(path.join(CONTENT_DIR, 'reading', file), 'utf-8');
    const { frontmatter, content } = parseFrontmatter(raw);
    readings.push({ slug: path.basename(file, '.mdx'), frontmatter, body: content });
  }
  return readings;
}

async function main() {
  const [articles, projects, roles, talks, site, engineering, reading] = await Promise.all([
    buildArticles(),
    buildProjects(),
    buildRoles(),
    buildTalks(),
    buildSite(),
    buildEngineering(),
    buildReading(),
  ]);

  const snapshot = { articles, projects, roles, talks, site, engineering, reading };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(`[build-content-snapshot] Wrote snapshot to ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
