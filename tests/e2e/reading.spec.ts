import { test, expect } from '@playwright/test';

/**
 * E2E tests for the /reading section (Work Item K).
 * All assertions run against the empty-state (zero reviews in content/reading/).
 *
 * NOTE (ledger rows 65 + 66):
 * - PT-BR archived for v1 launch — all /pt/reading tests are skipped; re-enable when _pt is restored.
 * - /reading nav removed from footer until section is seeded — footer-navigation test skipped;
 *   re-enable when the nav link is restored in Footer.astro and CommandPaletteMount.astro.
 */

test.describe('/reading page — EN', () => {
  test('renders the empty state', async ({ page }) => {
    await page.goto('/reading');
    await expect(page.locator('h1')).toBeVisible();
    // Empty state paragraph (not an empty shell).
    await expect(page.locator('p:has-text("Reviews land here")')).toBeVisible();
  });

  test('page title is visible', async ({ page }) => {
    await page.goto('/reading');
    await expect(page.locator('h1')).toContainText('What I read');
  });
});

test.describe('/pt/reading page — PT', () => {
  test('renders the empty state in Portuguese', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/reading');
    await expect(page.locator('h1')).toBeVisible();
    // PT empty-state copy
    await expect(page.locator('p:has-text("As resenhas chegam")')).toBeVisible();
  });

  test('PT page title is visible', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/reading');
    await expect(page.locator('h1')).toContainText('O que leio');
  });
});

test.describe('footer /reading link', () => {
  test('EN footer "Reading" link navigates to /reading', async ({ page }) => {
    // Reading nav removed from footer until section is seeded — see ledger row 66;
    // re-enable when the Reading link is restored in Footer.astro
    test.skip(true, 'Reading nav removed from footer until section is seeded — see ledger row 66; re-enable when nav link is restored');
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Reading' }).click();
    await expect(page).toHaveURL(/\/reading\/?$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('PT footer "Leituras" link navigates to /pt/reading', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Leituras' }).click();
    await expect(page).toHaveURL(/\/pt\/reading\/?$/);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('filter chips — hidden when empty', () => {
  test('no type filter section when zero reviews', async ({ page }) => {
    await page.goto('/reading');
    // Filter chips render only when readings.length > 0 — not present in empty state.
    await expect(page.locator('[aria-label="Filter by type"]')).not.toBeVisible();
    await expect(page.locator('[aria-label="Filter by domain"]')).not.toBeVisible();
  });
});

test.describe('/writing — no recently-reviewed strip when empty', () => {
  test('no recently-reviewed section on EN /writing when reviews = 0', async ({ page }) => {
    await page.goto('/writing');
    // Section only renders when recentlyReviewed.length > 0.
    await expect(page.locator('#recently-reviewed-heading')).not.toBeAttached();
  });

  test('no recently-reviewed section on PT /pt/writing when reviews = 0', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/writing');
    await expect(page.locator('#recently-reviewed-heading')).not.toBeAttached();
  });
});

test.describe('filter routes — always exist, show empty state when no content', () => {
  test('/reading/type/book responds with a page (not 404)', async ({ page }) => {
    const response = await page.goto('/reading/type/book');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Book');
    // Back link always present
    await expect(page.getByRole('link', { name: /Reading/i }).last()).toBeVisible();
  });

  test('/reading/domain/ai-agentic-engineering responds with a page (not 404)', async ({ page }) => {
    const response = await page.goto('/reading/domain/ai-agentic-engineering');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('AI & Agentic Engineering');
    await expect(page.getByRole('link', { name: /Reading/i }).last()).toBeVisible();
  });

  test('/pt/reading/type/article responds with a page (not 404)', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    const response = await page.goto('/pt/reading/type/article');
    expect(response?.status()).toBe(200);
    // PT type label
    await expect(page.locator('h1')).toContainText('Artigo');
  });

  test('/pt/reading/domain/cloud-platform-architecture responds with a page (not 404)', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    const response = await page.goto('/pt/reading/domain/cloud-platform-architecture');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Cloud & Platform Architecture');
  });
});

test.describe('markdown twin', () => {
  test('/reading/index.md responds with 200', async ({ request }) => {
    const resp = await request.get('/reading/index.md');
    expect(resp.status()).toBe(200);
    const text = await resp.text();
    // Should contain the section heading even with zero entries.
    expect(text).toContain('# Reading');
  });

  test('/pt/reading/index.md responds with 200', async ({ request }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    const resp = await request.get('/pt/reading/index.md');
    expect(resp.status()).toBe(200);
    const text = await resp.text();
    // PT section heading
    expect(text.toLowerCase()).toMatch(/reading|leituras/i);
  });
});
