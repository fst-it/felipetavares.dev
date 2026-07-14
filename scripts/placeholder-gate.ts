#!/usr/bin/env tsx
/**
 * Placeholder gate — scans dist/ for hero copy that is still using placeholder text.
 *
 * The hero on / and /pt/ ships with placeholder persona ("Alex Kern") and fictional stats
 * ("15y shipping / 40+ systems live / 7 agents in prod"). These MUST be replaced with real
 * copy before going live. See docs/superpowers/complaint-ledger.md for the tracking entry.
 *
 * This script is intentionally NOT wired into CI. Run it manually as part of the pre-deploy
 * checklist: `pnpm placeholder-gate`. Exit 0 = clean, exit 1 = placeholder text found in dist/.
 *
 * Usage:
 *   pnpm build          # produces dist/
 *   pnpm placeholder-gate
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

const PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'placeholder name "Alex Kern"',      pattern: /alex[\s-]?kern/i },
  { label: 'placeholder stat "15y shipping"',   pattern: /15y\s+shipping/i },
  { label: 'placeholder stat "40+ systems"',    pattern: /40\+\s+systems\s+live/i },
  { label: 'placeholder stat "7 agents"',       pattern: /7\s+agents\s+in\s+prod/i },
];

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.json', '.txt', '.xml', '.css']);

async function walk(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '_worker.js') continue;
      files.push(...(await walk(full)));
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

interface Hit { file: string; line: number; label: string; excerpt: string; }

async function main() {
  if (!existsSync(DIST_DIR)) {
    console.error('[placeholder-gate] dist/ not found — run `pnpm build` first.');
    process.exit(1);
  }

  const stat = statSync(DIST_DIR);
  const files = stat.isDirectory() ? await walk(DIST_DIR) : [DIST_DIR];
  const hits: Hit[] = [];

  for (const file of files) {
    const text = await readFile(file, 'utf-8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { label, pattern } of PATTERNS) {
        if (pattern.test(lines[i])) {
          hits.push({
            file: path.relative(ROOT, file),
            line: i + 1,
            label,
            excerpt: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
  }

  if (hits.length > 0) {
    console.error('\n[placeholder-gate] FAILED — placeholder copy found in dist/:');
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}  [${h.label}]`);
      console.error(`    ${h.excerpt}`);
    }
    console.error(
      '\n  Replace the placeholder hero copy with real content before deploying.' +
        '\n  See docs/superpowers/complaint-ledger.md for context.\n'
    );
    process.exit(1);
  }

  console.log(`[placeholder-gate] OK — scanned ${files.length} file(s), no placeholder copy found.`);
}

main().catch((err) => {
  console.error('[placeholder-gate] unexpected error:', err);
  process.exit(1);
});
