import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { scanText } from '../../../../src/core/services/redaction-gate';

/**
 * Defense in depth: the root `pnpm redaction-gate` (scripts/redaction-gate.ts) scans content/,
 * src/generated/chat-chunks.json, and the site's own dist/ — it does not know about
 * packages/mcp/dist/ (a separate build artifact). This package's dist/ never embeds content
 * literally (content-loader.ts reads content/ off disk at runtime, not at bundle time), so there's
 * nothing for a build-time bundler to have inlined — but this test proves that rather than assuming
 * it, using the exact same scanner the root gate uses. Skips (not fails) if dist/ hasn't been built
 * yet in this environment (e.g. a fresh checkout before `pnpm build`).
 */
describe('packages/mcp dist/ redaction check', () => {
  const distPath = path.resolve(process.cwd(), 'dist/stdio.js');

  it.skipIf(!existsSync(distPath))('the built stdio bundle contains no forbidden figures', () => {
    const content = readFileSync(distPath, 'utf-8');
    const violations = scanText('packages/mcp/dist/stdio.js', content);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
