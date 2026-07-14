import { test, expect } from '@playwright/test';

/**
 * Experience view toggle (item 11, 2026-07-06 refinement): segmented "Summary | Detailed"
 * control switches between the compact summary view and the full detailed chapter view.
 * Default view changed to Summary (2026-07-09 refinement, item D).
 */
test.describe('experience view toggle', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('defaults to summary view on /experience', async ({ page }) => {
    await page.goto('/experience', { waitUntil: 'networkidle' });

    // Summary view should be visible by default (compact cards).
    const summarySection = page.locator('.experience-summary');
    await expect(summarySection).toBeVisible();

    // Detailed view should be hidden.
    const detailedSection = page.locator('.experience-detailed');
    await expect(detailedSection).toBeHidden();
  });

  test('switching to Detailed shows full chapter cards', async ({ page }) => {
    await page.goto('/experience', { waitUntil: 'networkidle' });

    await page.getByRole('radio', { name: 'Detailed' }).click();

    await expect(page.locator('.experience-detailed')).toBeVisible();
    await expect(page.locator('.experience-summary')).toBeHidden();
  });

  test('switching back to Summary restores the compact view', async ({ page }) => {
    await page.goto('/experience', { waitUntil: 'networkidle' });

    await page.getByRole('radio', { name: 'Detailed' }).click();
    await page.getByRole('radio', { name: 'Summary' }).click();

    await expect(page.locator('.experience-summary')).toBeVisible();
    await expect(page.locator('.experience-detailed')).toBeHidden();
  });

  test('?view=detailed deep-link opens in detailed view', async ({ page }) => {
    await page.goto('/experience?view=detailed', { waitUntil: 'networkidle' });

    await expect(page.locator('.experience-detailed')).toBeVisible();
    await expect(page.locator('.experience-summary')).toBeHidden();
  });

  test('?view=summary deep-link opens in summary view', async ({ page }) => {
    await page.goto('/experience?view=summary', { waitUntil: 'networkidle' });

    await expect(page.locator('.experience-summary')).toBeVisible();
    await expect(page.locator('.experience-detailed')).toBeHidden();
  });

  test('sessionStorage persists the chosen view across navigations', async ({ page }) => {
    // Switch to Detailed, navigate away to a lightweight page, return — sessionStorage restores Detailed.
    await page.goto('/experience', { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: 'Detailed' }).click();
    await expect(page.locator('.experience-detailed')).toBeVisible();

    await page.goto('/experience/dossier', { waitUntil: 'networkidle' });
    await page.goto('/experience', { waitUntil: 'networkidle' });

    // Wait for the React island to hydrate and apply the sessionStorage value before checking
    // visibility. `networkidle` confirms the page loaded, but the island's `useEffect` (which
    // reads sessionStorage and sets data-experience-view) fires asynchronously after mount —
    // waiting for the attribute change proves the effect ran before we assert visibility.
    await expect(page.locator('#experience-chapters')).toHaveAttribute('data-experience-view', 'detailed');

    await expect(page.locator('.experience-detailed')).toBeVisible();
    await expect(page.locator('.experience-summary')).toBeHidden();
  });

  test('PT /pt/experience defaults to summary view and toggle works', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/experience', { waitUntil: 'networkidle' });

    // PT default should be Summary (Resumo).
    await expect(page.locator('.experience-summary')).toBeVisible();
    await expect(page.locator('.experience-detailed')).toBeHidden();

    // Switching to Detailed (Detalhado) works.
    await page.getByRole('radio', { name: 'Detalhado' }).click();
    await expect(page.locator('.experience-detailed')).toBeVisible();
    await expect(page.locator('.experience-summary')).toBeHidden();
  });
});
