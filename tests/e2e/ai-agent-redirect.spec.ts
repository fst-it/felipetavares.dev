import { test, expect } from '@playwright/test';

/**
 * Edge AI-agent detection (V3b addendum commit 3). `src/middleware.ts` documents a hard
 * constraint discovered while building this: Astro strips request headers for every prerendered
 * page (this site's entire content surface, `output: 'static'`) before middleware ever runs — not
 * a Cloudflare-deployment nuance, reproducible under plain `astro dev` too (see the middleware's
 * own doc comment and docs/ai-ready.md for the full trace). That means a bot-UA/Accept-header
 * redirect to the markdown twin cannot fire against any of this site's real content pages, in dev
 * or once deployed.
 *
 * This suite asserts the actual, current behavior — a bot UA reaches the normal HTML page
 * unredirected, exactly like a normal browser — so a future regression (e.g. someone "fixing" the
 * middleware to redirect without first flipping the target route to `prerender = false`, which
 * would silently 404 since the .md endpoint wouldn't exist yet either) is caught rather than
 * masked by a test asserting behavior the framework doesn't allow.
 */
test.describe('AI-agent edge redirect', () => {
  test('a known bot User-Agent still receives the normal HTML page (prerendered — Astro strips headers)', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://www.anthropic.com)' });
    const page = await context.newPage();

    const response = await page.goto('/experience');
    expect(response?.status()).toBe(200);
    expect(response?.url()).toContain('/experience');
    expect(response?.url()).not.toContain('.md');
    await expect(page.locator('main h1')).toBeVisible();

    await context.close();
  });

  test('a request with Accept: text/markdown still receives the normal HTML page', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ accept: 'text/markdown' });

    const response = await page.goto('/contact');
    expect(response?.status()).toBe(200);
    expect(response?.url()).not.toContain('.md');

    await context.close();
  });

  test('a normal browser User-Agent gets the HTML page, unaffected', async ({ page }) => {
    const response = await page.goto('/experience');
    expect(response?.url()).not.toContain('.md');
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('the markdown twin itself is reachable directly, regardless of middleware', async ({ request }) => {
    // This is the layer that actually works today: the twin exists and is fetchable — an agent
    // that follows the <link rel="alternate" type="text/markdown"> tag or the llms.txt listing
    // gets it without depending on any redirect.
    const response = await request.get('/experience/index.md');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
  });
});
