#!/usr/bin/env tsx
/**
 * Redaction gate CLI (V2 addendum section 6 + phase gate table: "no employer-tied figures
 * anywhere in dist/ (grep gate)"). Closes a flagged gap: V2a's redaction pass was verified by
 * hand; this automates it as a repeatable, CI-runnable check.
 *
 * Scans (does not build anything itself):
 *   - content/           (all *.mdx, *.json — the CMS source of truth)
 *   - src/generated/chat-chunks.json  (rebuilt after redaction passes per addendum section 6;
 *     scanned directly so a stale pre-redaction chunk can't ship to the chatbot)
 *   - packages/mcp/src/generated/content-snapshot.json  (MCP commit 3's content snapshot — same
 *     rationale as chat-chunks.json: a derived copy of content/ that both MCP transports read, so
 *     it's scanned directly rather than assumed clean by extension)
 *   - dist/              (only if present — post-`astro build` output; CI runs this script twice,
 *     once before build to gate source content and once after to gate the built site)
 *
 * Usage: pnpm redaction-gate
 * Exit code: 0 = clean, 1 = violations found (report printed to stderr).
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { scanText, formatReport, type Violation } from '../src/core/services/redaction-gate';

const ROOT = process.cwd();

// Only scan text-ish files; skip binaries/images/fonts that could false-positive on byte content
// or just waste time.
const TEXT_EXTENSIONS = new Set([
  '.mdx',
  '.md',
  '.json',
  '.html',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.astro',
  '.txt',
  '.xml',
  '.css',
]);

async function walk(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // node_modules can appear vendored inside dist in some adapters; never worth scanning.
      // _worker.js/ is the Cloudflare adapter's compiled Worker bundle — it contains minified
      // source code (including the DENY_LIST array literal from selfwright-metrics-curation.ts)
      // which is not user-visible content; scanning it would produce false-positives for the
      // deny-list strings that appear in the canonical source code definition itself.
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '_worker.js') continue;
      files.push(...(await walk(full)));
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

async function scanPath(target: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  if (!existsSync(target)) return violations;

  const stat = statSync(target);
  const files = stat.isDirectory() ? await walk(target) : [target];

  for (const file of files) {
    const text = await readFile(file, 'utf-8');
    const relPath = path.relative(ROOT, file);
    violations.push(...scanText(relPath, text));
  }
  return violations;
}

async function main() {
  const targets = [
    path.join(ROOT, 'content'),
    path.join(ROOT, 'src/generated/chat-chunks.json'),
    path.join(ROOT, 'packages/mcp/src/generated/content-snapshot.json'),
  ];

  const distDir = path.join(ROOT, 'dist');
  if (existsSync(distDir)) {
    targets.push(distDir);
    console.log('[redaction-gate] dist/ present — including it in the scan.');
  } else {
    console.log('[redaction-gate] dist/ not found — skipping (run again after `pnpm build` to gate build output).');
  }

  const allViolations: Violation[] = [];
  for (const target of targets) {
    allViolations.push(...(await scanPath(target)));
  }

  if (allViolations.length > 0) {
    console.error(formatReport(allViolations));
    console.error(
      '\n[redaction-gate] FAILED — remove or generalize the figures above (see addendum section 6),' +
        ' or add a narrowly-scoped allow-list entry in src/core/services/redaction-gate.ts if this is a' +
        ' legitimate, approved exception.'
    );
    process.exit(1);
  }

  console.log(`[redaction-gate] OK — scanned ${targets.length} target(s), no forbidden patterns found.`);
}

main().catch((err) => {
  console.error('[redaction-gate] unexpected error:', err);
  process.exit(1);
});
