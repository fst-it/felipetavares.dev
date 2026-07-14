import { defineConfig } from 'tsup';

// Bundles cross-package imports (../../src/core/*, ../../src/adapters/embedding-index/*) into a
// single dist/ output — the published package never leaks the monorepo's relative path structure,
// and there's no need to reconcile this package's Node ESM runtime with the root project's
// bundler-resolved (Vite/Astro) module graph. `format: esm` matches package.json's "type": "module".
export default defineConfig({
  entry: { stdio: 'src/stdio.ts', worker: 'src/worker.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: false,
  sourcemap: true,
  // No shared chunk between stdio.js and worker.js — each stays a single self-contained file.
  // stdio.js is the published bin entry (npm pack ships dist/ as-is); worker.js is a standalone
  // Cloudflare Worker script wrangler uploads on its own. Splitting would make either depend on a
  // sibling chunk file that isn't meaningful outside this build's own dist/ directory.
  splitting: false,
  // No `banner` here — src/stdio.ts already starts with its own `#!/usr/bin/env node` shebang
  // comment, which tsup preserves as-is; adding a banner would duplicate it (a second shebang line
  // is invalid JS, since only line 1 is special-cased by Node).
});
