import { test, expect } from '@playwright/test';

/**
 * Post-deploy smoke suite — runs against the live site (SMOKE_BASE_URL, defaulting to
 * https://felipetavares-dev.pages.dev). No webServer; configured in playwright.smoke.config.ts.
 *
 * Run: pnpm smoke
 * Run against custom domain: SMOKE_BASE_URL=https://felipetavares.dev pnpm smoke
 *
 * The contact-form POST is gated behind SMOKE_CONTACT=1 to avoid emailing the owner on every
 * smoke run. All other checks run unconditionally.
 */

/** The fallback marker emitted when the chat API has no grounded answer (chat-service.ts). */
const DONT_KNOW_MARKER = "I don't have enough on the site";

// ---------------------------------------------------------------------------
// Page-level 200 + title checks
// ---------------------------------------------------------------------------

test('home page responds 200 and carries the site title', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Felipe Tavares/);
});

test('/experience responds 200', async ({ page }) => {
  const res = await page.goto('/experience');
  expect(res?.status()).toBe(200);
});

test('/projects responds 200', async ({ page }) => {
  const res = await page.goto('/projects');
  expect(res?.status()).toBe(200);
});

test('/writing responds 200', async ({ page }) => {
  const res = await page.goto('/writing');
  expect(res?.status()).toBe(200);
});

test('/contact responds 200', async ({ page }) => {
  const res = await page.goto('/contact');
  expect(res?.status()).toBe(200);
});

test('/reading responds 200', async ({ page }) => {
  const res = await page.goto('/reading');
  expect(res?.status()).toBe(200);
});

test('404 page responds 404 and renders a helpful message', async ({ page }) => {
  const res = await page.goto('/this-path-definitely-does-not-exist');
  expect(res?.status()).toBe(404);
  // The site has a custom 404 page — verify it renders (not a bare server 404).
  await expect(page.locator('body')).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// API endpoints
// ---------------------------------------------------------------------------

test('/api/cv.json returns a JSON Resume with 7 work entries', async ({ request }) => {
  const res = await request.get('/api/cv.json');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/application\/json/);
  const body = await res.json() as { work?: unknown[] };
  expect(Array.isArray(body.work)).toBe(true);
  expect(body.work!.length).toBe(7);
});

test('/rss.xml responds with an RSS feed', async ({ request }) => {
  const res = await request.get('/rss.xml');
  expect(res.status()).toBe(200);
  const ct = res.headers()['content-type'] ?? '';
  // Cloudflare may serve it as application/xml or text/xml depending on CF edge configuration.
  expect(ct).toMatch(/xml/);
  const text = await res.text();
  expect(text).toContain('<rss');
});

test('/llms.txt responds', async ({ request }) => {
  const res = await request.get('/llms.txt');
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text.length).toBeGreaterThan(100);
});

// ---------------------------------------------------------------------------
// Chat API — grounded response (not the DONT_KNOW fallback)
// ---------------------------------------------------------------------------

test('POST /api/chat answers a known question with a grounded response', async ({ request }) => {
  // Ask about Selfwright — well-indexed in the chat chunks, should produce a grounded answer.
  const res = await request.post('/api/chat', {
    data: {
      messages: [{ role: 'user', content: 'What is Selfwright?' }],
      page: '/',
    },
    headers: { 'Content-Type': 'application/json' },
  });

  // May 429 if the smoke IP hit rate limits from a prior run — that still means the API is up.
  if (res.status() === 429) {
    console.warn('[smoke] /api/chat 429 — rate limited; API is alive, skipping grounding assertion');
    return;
  }

  expect(res.status()).toBe(200);
  const text = await res.text();
  // The SSE stream must contain at least one delta event.
  expect(text).toContain('event: delta');
  // Must NOT return the dont-know fallback — that means retrieval found nothing.
  expect(text).not.toContain(DONT_KNOW_MARKER);
  // The sources event must reference /projects/selfwright.
  expect(text).toContain('/projects/selfwright');
});

// ---------------------------------------------------------------------------
// Contact form POST (opt-in — SMOKE_CONTACT=1)
// ---------------------------------------------------------------------------

test('POST /api/contact returns {ok:true} for a test payload', async ({ request }) => {
  test.skip(
    !process.env.SMOKE_CONTACT,
    'contact form POST skipped — set SMOKE_CONTACT=1 to enable (will trigger a real email send)'
  );

  // Turnstile: the live site uses the always-pass Cloudflare test secret
  // (TURNSTILE_SECRET=1x0000000000000000000000000000000AA from ledger row 79),
  // so any token string passes server-side verification.
  const res = await request.post('/api/contact', {
    data: {
      name: '[smoke test] ignore',
      email: 'smoke-test@felipetavares.dev',
      topic: 'Other',
      message: 'Automated smoke test — ignore this message.',
      turnstileToken: 'smoke-test-bypass-token',
      locale: 'en',
    },
    headers: { 'Content-Type': 'application/json' },
  });

  // 429 is acceptable — means API is alive, just rate-limited.
  if (res.status() === 429) {
    console.warn('[smoke] /api/contact 429 — rate limited; test passes');
    return;
  }

  expect(res.status()).toBe(200);
  const body = await res.json() as { ok: boolean };
  expect(body.ok).toBe(true);
});
