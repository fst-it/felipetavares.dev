import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Architecture boundary guards (V5c commit 3). Statically scans this repo's own source files for
 * import statements that would violate the hexagonal layering documented in docs/architecture.md
 * — no new dependency, just `fs` + regex, so this suite has zero extra maintenance surface.
 *
 * These are import-statement checks, not a full module graph: they catch the actual regression
 * class each rule exists for (a stray `import ... from 'astro:content'` in an island, an adapter
 * reaching into a sibling adapter, an LLM SDK import outside the sanctioned chat path) without
 * needing a bundler or type-checker in the loop.
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');

/** Recursively lists files under `dir` with one of the given extensions, skipping `__tests__`. */
function listFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/** Extracts the module specifier of every static `import`/`export ... from` statement, ignoring
 *  `import type`/`export type` (type-only imports are erased at compile time — they can't leak a
 *  runtime dependency across a layer boundary, e.g. HeroBlueprint.tsx's `import type` of a script's
 *  return-type shape). Astro frontmatter is plain JS/TS between the leading `---` fences, so the
 *  same regex works unmodified on `.astro` files. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /^\s*import\s+(?!type\s)[^;]*?from\s+['"]([^'"]+)['"]/gm;
  const exportFromRe = /^\s*export\s+(?!type\s)[^;]*?from\s+['"]([^'"]+)['"]/gm;
  const bareImportRe = /^\s*import\s+['"]([^'"]+)['"]/gm;
  for (const re of [importRe, exportFromRe, bareImportRe]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) specifiers.push(match[1]);
  }
  return specifiers;
}

function relative(file: string): string {
  return path.relative(SRC_ROOT, file).replace(/\\/g, '/');
}

describe('architecture boundaries (docs/architecture.md)', () => {
  it('src/core imports no framework/adapter code', () => {
    const files = listFiles(path.join(SRC_ROOT, 'core'), ['.ts', '.tsx']);
    const violations: string[] = [];

    for (const file of files) {
      const specifiers = importSpecifiers(readFileSync(file, 'utf-8'));
      for (const spec of specifiers) {
        const isFramework =
          spec === 'astro' ||
          spec.startsWith('astro:') ||
          spec.startsWith('@astrojs/') ||
          spec === 'react' ||
          spec.startsWith('react/') ||
          spec.startsWith('react-dom');
        const isAdapterReach = spec.includes('/adapters/') || spec.startsWith('../adapters') || spec.startsWith('../../adapters');
        if (isFramework || isAdapterReach) {
          violations.push(`${relative(file)} imports "${spec}"`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('adapters do not import sibling adapters', () => {
    const adaptersRoot = path.join(SRC_ROOT, 'adapters');
    const files = listFiles(adaptersRoot, ['.ts', '.tsx']);
    const violations: string[] = [];

    for (const file of files) {
      // Which adapter package this file itself belongs to, e.g. "content-git", "llm".
      const ownPackage = path.relative(adaptersRoot, file).split(path.sep)[0];
      const specifiers = importSpecifiers(readFileSync(file, 'utf-8'));

      for (const spec of specifiers) {
        // Resolve relative specifiers against this file's own directory (not just string-match
        // "adapters/" — a same-tree sibling import like '../llm/anthropic' from
        // adapters/rate-limit/in-memory.ts never re-mentions the literal word "adapters").
        // Non-relative specifiers (bare package names) can't reach another adapter this way, so
        // they're skipped rather than mis-resolved against process.cwd().
        if (!spec.startsWith('.')) continue;
        const resolved = path.resolve(path.dirname(file), spec);
        const relToAdapters = path.relative(adaptersRoot, resolved);
        if (relToAdapters.startsWith('..')) continue; // resolves outside src/adapters entirely
        const targetPackage = relToAdapters.split(path.sep)[0];
        if (targetPackage !== ownPackage) {
          violations.push(`${relative(file)} (adapter "${ownPackage}") imports adapter "${targetPackage}" via "${spec}"`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('islands never import server-only modules', () => {
    const files = listFiles(path.join(SRC_ROOT, 'components', 'islands'), ['.ts', '.tsx']);
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      const specifiers = importSpecifiers(source);

      for (const spec of specifiers) {
        const isServerOnly =
          spec === 'astro:content' ||
          spec.startsWith('astro:') ||
          spec.startsWith('node:') ||
          spec.includes('/adapters/') ||
          spec.startsWith('../adapters') ||
          spec.startsWith('../../adapters');
        if (isServerOnly) {
          violations.push(`${relative(file)} imports server-only module "${spec}"`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('only the chat path may reference an LLM provider SDK or API endpoint', () => {
    // The sanctioned surface (spec + V5c mandate): the chat service itself, every adapter under
    // adapters/llm/*, and config/llm.ts — the single binding point (mirrors config/site.ts binding
    // ContentRepository) that wires a provider adapter to the port for POST /api/chat to consume.
    // Deliberately NOT flagged elsewhere: `src/core/ports/llm-provider.ts` (the port interface
    // itself — its doc comments name providers, but it imports none), `config/ai-agents.ts` (AI-
    // *crawler* User-Agent detection — an unrelated concern that happens to share vocabulary like
    // "anthropic-ai"), and `adapters/embedding-index/vectorize-index.ts` (Workers AI's *embedding*
    // model via the same `env.AI` binding — a separate port/concern from chat completion).
    const allowedFiles = new Set([
      path.join(SRC_ROOT, 'core', 'services', 'chat-service.ts'),
      path.join(SRC_ROOT, 'config', 'llm.ts'),
    ]);
    const allowedDirs = [path.join(SRC_ROOT, 'adapters', 'llm')];

    // Import specifiers for provider SDKs (none are installed today — the site talks to providers
    // over plain `fetch`/Workers bindings rather than an SDK, precisely so this list can stay this
    // short) and the concrete provider API hosts hardcoded as fetch targets in the two REST-based
    // adapters. A real regression looks like: a new file importing `@anthropic-ai/sdk`/`openai`, or
    // hardcoding `api.anthropic.com`/`api.openai.com` as a fetch URL, outside the allowed surface.
    const sdkImportMarkers = ['@anthropic-ai/sdk', '@anthropic-ai/', 'openai', '@google/generative-ai'];
    const apiHostMarkers = ['api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com'];

    const allFiles = listFiles(SRC_ROOT, ['.ts', '.tsx', '.astro']);
    const violations: string[] = [];

    for (const file of allFiles) {
      if (allowedFiles.has(file)) continue;
      if (allowedDirs.some((dir) => file.startsWith(dir + path.sep))) continue;

      const source = readFileSync(file, 'utf-8');
      const specifiers = importSpecifiers(source);

      for (const spec of specifiers) {
        if (sdkImportMarkers.some((marker) => spec.includes(marker))) {
          violations.push(`${relative(file)} imports LLM SDK "${spec}" outside the sanctioned chat path`);
        }
      }
      for (const host of apiHostMarkers) {
        if (source.includes(host)) {
          violations.push(`${relative(file)} references LLM API host "${host}" outside the sanctioned chat path`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
