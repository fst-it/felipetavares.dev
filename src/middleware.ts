import { defineMiddleware } from 'astro:middleware';
import { isKnownAiAgent, prefersMarkdown } from './config/ai-agents';

/**
 * Edge AI-agent detection (V3b addendum commit 3). For HTML page requests, redirects known AI
 * crawlers/agents (User-Agent match) or requests whose Accept header prefers text/markdown
 * straight to that page's markdown twin (V3b commit 2) — humans requesting HTML are completely
 * unaffected.
 *
 * CRITICAL REALITY CHECK — two independent layers block this in the site's current architecture,
 * one deeper than the addendum anticipated (full writeup in docs/ai-ready.md):
 *
 * 1. Astro itself, not just Cloudflare: every content page here is prerendered (the default under
 *    `output: 'static'`, and none of them opt out). Astro's own request constructor
 *    (`node_modules/astro/dist/core/request.js`) unconditionally sets `headers: undefined` when
 *    building the `Request` for a prerendered route — the dev server passes `isPrerendered:
 *    route.prerender` into that constructor *before* middleware ever runs (confirmed by tracing
 *    `vite-plugin-astro-server/route.js`), and this is not a Cloudflare-adapter quirk: it
 *    reproduces identically under plain `astro dev`. Concretely, `request.headers.get(...)`
 *    returns a header set with no User-Agent for every prerendered page, in dev AND in
 *    production — Astro's own console warning even says so ("`Astro.request.headers` is not
 *    available on prerendered pages ... make sure the page is server-rendered"). This middleware
 *    therefore cannot see the User-Agent for `/`, `/experience`, `/projects/*`, `/writing/*`,
 *    `/speaking`, `/contact`, or `/experience/dossier` — every page a bot would actually land on.
 * 2. Only on top of that would the Cloudflare Pages routing gap apply: `@astrojs/cloudflare`
 *    12.6.9 + this project's Pages-style `wrangler.jsonc` (`pages_build_output_dir`) emits a
 *    `dist/_routes.json` that excludes every prerendered route from Worker invocation entirely —
 *    Cloudflare Pages serves those straight from its static asset store. `run_worker_first`
 *    (which forces a route through the Worker first) belongs to the newer Workers-with-
 *    Static-Assets `assets` config block, a different deployment model than
 *    `pages_build_output_dir`; adopting it would be a deployment-model migration, not a config
 *    tweak, and is out of scope here.
 *
 * Net effect: as shipped, this middleware is a correctly-wired no-op against every real content
 * page, by design of the framework, not a bug in this file — flipping the specific pages to
 * `export const prerender = false` is the only way to make header-based detection functional, and
 * that trades away CDN-static serving (this site's actual $0/free-tier serving model) for those
 * routes, which is a deliberate architectural decision this change does not make unilaterally.
 * The one place this file's logic *can* fire is a route that's already `prerender = false`
 * (`/api/contact`, `/api/chat`) — neither is an HTML page a bot navigates to, so there is nothing
 * for `markdownTwinFor()` to match there either. The guarantee for AI agents in production is
 * therefore entirely the PASSIVE layer already shipped in V3b commit 2: the
 * `<link rel="alternate" type="text/markdown">` tag and the llms.txt/llms-full.txt twin listing —
 * both reach agents with zero dependency on anything running at request time.
 */

/** Maps an HTML pathname to its markdown twin's pathname, or undefined if it has none. */
function markdownTwinFor(pathname: string): string | undefined {
  if (pathname === '/') return '/home.md';
  if (pathname === '/experience' || pathname === '/experience/') return '/experience/index.md';
  if (pathname === '/experience/dossier' || pathname === '/experience/dossier/') return '/experience/dossier.md';
  if (pathname === '/speaking' || pathname === '/speaking/') return '/speaking/index.md';
  if (pathname === '/contact' || pathname === '/contact/') return '/contact/index.md';

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (projectMatch) return `/projects/${projectMatch[1]}.md`;

  const writingMatch = pathname.match(/^\/writing\/([^/]+)\/?$/);
  if (writingMatch) return `/writing/${writingMatch[1]}.md`;

  return undefined;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;

  // Only ever redirect actual HTML page navigations — never touch the .md twins, API routes,
  // static assets, or already-markdown/JSON requests (avoids any possibility of a redirect loop).
  if (url.pathname.endsWith('.md') || url.pathname.startsWith('/api/')) {
    return next();
  }

  // Every content page on this site is prerendered (see the doc comment above): Astro gives
  // prerendered routes a Request with no real headers, so there is nothing to read here. Bailing
  // out on `context.isPrerendered` before touching `request.headers` avoids Astro's own
  // "headers not available on prerendered pages" console warning on every single build/dev
  // request, and documents in code exactly why this never fires today.
  if (context.isPrerendered) {
    return next();
  }

  const userAgent = request.headers.get('user-agent');
  const accept = request.headers.get('accept');
  const isAiAgent = isKnownAiAgent(userAgent) || prefersMarkdown(accept);

  if (!isAiAgent) return next();

  const twin = markdownTwinFor(url.pathname);
  if (!twin) return next();

  return context.redirect(twin, 302);
});
