// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import keystatic from '@keystatic/astro';
import { remarkReadingTime } from './src/lib/remark-reading-time.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// brain-config-1b.js uses CJS `module.exports` with no ES `export` statements.
// In dev mode, Vite serves source files as native ESM. The CJS export line is gated on
// `typeof module !== 'undefined'`, which is false in browser ESM — so there are no named
// exports and `import { BRAIN_CONFIG_1B }` fails at runtime.
//
// Vite's `transform` hook fires but its output affects only SSR module evaluation
// (where Vite's ssrLoadModule provides a synthetic `module` object so CJS interop works).
// For browser HTTP requests, Vite serves the pre-transform file content, ignoring the
// `transform` return value. Fix: intercept at the HTTP layer via `configureServer`.
//
// In production, build.commonjsOptions.include applies @rollup/plugin-commonjs which adds
// named ES exports — the middleware never runs (configureServer is dev-only).
// `@types/node` and `vite` are not hoisted in this project's pnpm layout, so types are
// annotated explicitly below rather than via `import('vite').Plugin` or `import('http').X`.
const brainConfigEsmShim = {
  name: 'brain-config-esm-shim',
  /** @param {any} server */
  configureServer(server) {
    /** @type {(req: any, res: any, next: any) => void} */
    const mw = (req, res, next) => {
      if (!req.url?.startsWith('/src/lib/brain/brain-config-1b.js')) return next();
      const filePath = resolve(process.cwd(), 'src/lib/brain/brain-config-1b.js');
      try {
        const code = readFileSync(filePath, 'utf-8');
        const modified = code + '\nexport { BRAIN_CONFIG_1B };\n';
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(modified);
      } catch {
        next();
      }
    };
    server.middlewares.use(mw);
  },
};

// Keystatic (spec sections 4 & 14) is dev-only by construction: its integration injects
// non-prerendered /keystatic and /api/keystatic routes for an admin UI backed by local
// filesystem writes, which has no business existing in the production build/deploy. `command`
// isn't available at top-level config (only inside integration hooks), so this checks the CLI
// invocation directly — `astro build` (and its `astro check`/`astro sync` siblings that also
// touch build output) never register the integration, rather than relying on a per-route
// runtime guard inside routes that would otherwise still ship.
const isBuildCommand = process.argv.some((arg) => arg === 'build');

// https://astro.build/config
// Hybrid output: pages are prerendered (static) by default; /api/* routes opt into
// server rendering individually via `export const prerender = false`.
export default defineConfig({
  site: 'https://felipetavares.dev',
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  // i18n (V3d addendum): English at the unprefixed root, Portuguese under /pt/. The locale code
  // stays the correct BCP-47 `pt-br` (matches `content/site/site.pt-br.json`'s suffix and the
  // `pt-br` dictionary key in src/i18n/) while the URL path prefix is the shorter, more common
  // `pt` — Astro's mapped-locale form (`{ path, codes }`) decouples the two. `prefixDefaultLocale:
  // false` keeps English unprefixed for SEO/URL stability on the existing site. No `fallback`
  // configured: pages that don't have a PT counterpart (individual articles/project deep-dives,
  // v1 scope decision) simply aren't built under /pt/ and are linked out to directly rather than
  // redirected/rewritten.
  i18n: {
    locales: ['en', { path: 'pt', codes: ['pt-br'] }],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
  integrations: [
    react(),
    mdx(),
    // @astrojs/sitemap does NOT read the top-level `i18n` block above automatically (verified
    // against the installed 3.7.3 source: its own `i18n` option is a separate, required-if-you-
    // want-hreflang config keyed by URL path segment, not locale code) — `pt` here is the URL
    // prefix segment (matches `i18n.locales`'s `{ path: 'pt' }` above), mapped to the BCP-47 code
    // used in the emitted `xhtml:link hreflang` attribute.
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          pt: 'pt-BR',
        },
      },
    }),
    ...(isBuildCommand ? [] : [keystatic()]),
  ],
  vite: {
    plugins: [tailwindcss(), brainConfigEsmShim],
    build: {
      // Extend Rollup's CJS transform to cover the vendored brain files (IIFE + module.exports
      // pattern). Without this, Rollup treats them as ES modules and can't find named exports.
      commonjsOptions: {
        include: [/node_modules/, /src[\\/]lib[\\/]brain[\\/]/],
      },
    },
    server: {
      // Dev-only: lets Cloudflare quick tunnels (remote device review of /lab) through Vite's
      // host check. No effect on production builds.
      allowedHosts: ['.trycloudflare.com'],
    },
    ssr: {
      // The OG-image generator (src/lib/og-image.tsx, used only by the prerendered
      // src/pages/og/[...slug].png.ts route) pulls in @resvg/resvg-js, which ships a native
      // .node binary. It only ever runs during the build-time prerender pass under plain Node —
      // never inside the Cloudflare Workers server bundle — so it must stay external rather than
      // get rolled into the SSR chunk, which chokes on bundling a native binary as JS.
      external: ['@resvg/resvg-js', 'satori'],
    },
    optimizeDeps: {
      // Same reasoning as ssr.external above, but for Vite dev server's dependency pre-bundler
      // (esbuild), which has its own separate scan and otherwise fails trying to parse the
      // native .node binary as JS when `pnpm dev` first hits the /og/*.png route.
      exclude: ['@resvg/resvg-js', 'satori'],
    },
  },
});
