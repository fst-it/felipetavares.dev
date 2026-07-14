import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Architecture boundary guards for packages/mcp, extending the same rules
 * src/core/__tests__/architecture.test.ts enforces for the site (docs/architecture.md): this
 * package is a delivery surface like src/pages — it consumes src/core services/ports and
 * src/adapters/* directly (its own binding point, mirroring src/config/llm.ts), but must never
 * reimplement core logic, never cross-import a sibling adapter package, and must keep LLM SDK/API
 * access confined to the sanctioned chat path (extended here to this package's own ask_felipe tool
 * once it exists — see commit 2).
 */

const PKG_ROOT = path.resolve(process.cwd());
const PKG_SRC = path.join(PKG_ROOT, 'src');

function listFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

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
  return path.relative(PKG_ROOT, file).replace(/\\/g, '/');
}

describe('architecture boundaries — packages/mcp (mirrors src/core/__tests__/architecture.test.ts)', () => {
  it('no file in packages/mcp imports an Astro/React framework module', () => {
    const files = listFiles(PKG_SRC, ['.ts', '.tsx']);
    const violations: string[] = [];

    for (const file of files) {
      const specifiers = importSpecifiers(readFileSync(file, 'utf-8'));
      for (const spec of specifiers) {
        const isFramework =
          spec === 'astro' ||
          spec.startsWith('astro:') ||
          spec.startsWith('@astrojs/react') ||
          spec === 'react' ||
          spec.startsWith('react/') ||
          spec.startsWith('react-dom');
        if (isFramework) {
          violations.push(`${relative(file)} imports "${spec}"`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('only this package\'s own binding points import a given adapter package (mirrors src/config/*.ts\'s exclusivity)', () => {
    // Each adapter package may only be imported by the specific file(s) responsible for binding it
    // — the same discipline src/config/llm.ts and src/config/site.ts enforce site-side. A tool
    // reaching directly into an adapter instead of going through config.ts, or a transport entry
    // reaching into an adapter its binding point doesn't own, is the regression this catches.
    const allowedImporters: Record<string, string[]> = {
      // search-content.ts and ask-felipe.ts both retrieve from the same lexical index directly —
      // legitimate since retrieval has no credential/config to bind (unlike llm/email).
      'embedding-index': ['src/tools/search-content.ts', 'src/tools/ask-felipe.ts'],
      // config.ts is this package's single LLM/email binding point (mirrors src/config/llm.ts).
      llm: ['src/config.ts'],
      'email-console': ['src/config.ts'],
      'email-resend': ['src/config.ts'],
      // Each transport entry constructs its own RateLimiter adapter (stdio: in-memory; worker: KV).
      'rate-limit': ['src/stdio.ts', 'src/worker.ts'],
    };

    const files = listFiles(PKG_SRC, ['.ts', '.tsx']);
    const violations: string[] = [];

    for (const file of files) {
      const specifiers = importSpecifiers(readFileSync(file, 'utf-8'));
      for (const spec of specifiers) {
        if (!spec.includes('/adapters/')) continue;
        const match = spec.match(/\/adapters\/([^/]+)\//);
        const adapterDir = match?.[1];
        if (!adapterDir) continue;

        const allowed = allowedImporters[adapterDir] ?? [];
        if (!allowed.includes(relative(file))) {
          violations.push(`${relative(file)} imports adapter "${adapterDir}" via "${spec}" (only ${allowed.join(', ') || '(nothing)'} may)`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('only the sanctioned chat/ask_felipe path may reference an LLM provider SDK or API endpoint', () => {
    // Mirrors src/core/__tests__/architecture.test.ts's rule 4. `ask_felipe` (commit 2) routes
    // through src/core/services/chat-service.ts and src/adapters/llm/* (the site's existing
    // sanctioned path, bound here via config.ts) rather than adding a second LLM call surface —
    // this guard checks no *other* file in this package ever imports a provider SDK/API directly.
    const sdkImportMarkers = ['@anthropic-ai/sdk', '@anthropic-ai/', 'openai', '@google/generative-ai'];
    const apiHostMarkers = ['api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com'];

    const allFiles = listFiles(PKG_SRC, ['.ts', '.tsx']);
    const violations: string[] = [];

    for (const file of allFiles) {
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
