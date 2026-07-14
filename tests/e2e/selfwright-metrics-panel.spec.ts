import { test, expect } from '@playwright/test';

// Build stage: "Selfwright eval surface" — the "Measured, not claimed" panel on the Selfwright
// deep-dive, populated from content/metrics/selfwright.json (pnpm import-selfwright-metrics).
test.describe('Selfwright "Measured, not claimed" panel', () => {
  test('renders curated stat-tile groups with capturedAt and no denied content', async ({ page }) => {
    await page.goto('/selfwright');

    const heading = page.getByRole('heading', { name: 'Measured, not claimed' });
    await expect(heading).toBeVisible();

    // Intro line states the snapshot is curated and shows a captured date.
    const intro = page.locator('.selfwright-metrics-panel p').first();
    await expect(intro).toContainText('snapshot, curated');

    // At least one real, previously-verified metric group renders (Tier-1 checks reflect CI fitness
    // results captured in content/metrics/selfwright.json — see scripts/import-selfwright-metrics.ts).
    await expect(page.getByText('Tier-1 checks (CI-safe, no private data)')).toBeVisible();

    // Hard exclusion, checked at the rendered-page level too (belt-and-suspenders alongside the
    // deny-list unit tests and the redaction gate): the panel itself never surfaces pipeline-
    // volume/application-count figures or a named target company as a metric value. Scoped to
    // the panel's own tiles (not the whole page) — the MDX body's docs callout legitimately
    // *names* these excluded categories when explaining the deny-list, which isn't a leak of the
    // excluded data itself.
    const panelText = await page.locator('.selfwright-metrics-panel').innerText();
    expect(panelText).not.toMatch(/\d+\s+applications?\s+submitted|application count:|pipeline volume:/i);
    expect(panelText).not.toMatch(/Trafigura|Booking\.com|Aviva|\bCiti\b|\bBain\b|\bBCG\b/);
  });

  test('does not appear on a different project page', async ({ page }) => {
    await page.goto('/projects/felipetavares-dev');
    await expect(page.getByRole('heading', { name: 'Measured, not claimed' })).toHaveCount(0);
  });
});
