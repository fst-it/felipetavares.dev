import { test, expect } from '@playwright/test';

// V5a fix 7: DetailSheet's overlay used to render `position: fixed` relative to its nearest
// `.glass` ancestor (backdrop-filter establishes a containing block for fixed-position
// descendants) instead of the viewport, because ProjectDeepDiveCards.astro wraps each DetailSheet
// trigger in a `.glass` card. Verified via the Problem/Approach/Architecture/Results card row on a
// project deep-dive page — the same bug class as the chat launcher fix (a5c82ad).
test.describe('detail sheet', () => {
  test('opens as a full-viewport-centered panel from inside a glass card, not trapped inside it', async ({
    page,
  }) => {
    // Complex deep-dive page + client:visible hydration needs more than the 30s default.
    test.setTimeout(60_000);

    await page.goto('/projects/felipetavares-dev', { waitUntil: 'networkidle' });

    // DetailSheet uses `client:visible` — scroll the first trigger into view so the
    // IntersectionObserver fires and Astro starts downloading the island bundle.
    await page.locator('[data-island="detail-sheet"]').first().scrollIntoViewIfNeeded();

    const allTriggers = page.locator('button:has-text("More")');
    await expect(allTriggers).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await allTriggers.nth(i).scrollIntoViewIfNeeded();
    }

    const first = allTriggers.nth(0);
    await expect(async () => {
      // Hydration check inside the retry loop: avoids a separate sequential wait that could
      // exhaust the test timeout. Once the trigger is scrolled into view, client:visible
      // hydration is fast; the 2s inner timeout just short-circuits early retries.
      await page.locator('[data-island="detail-sheet"][data-hydrated="true"]').first().waitFor({ timeout: 2_000 });
      await first.click();
      await expect(page.locator('.detail-sheet-overlay')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });

    const overlay = page.locator('.detail-sheet-overlay');
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      // A trapped overlay would be sized/positioned to its small parent card, not the viewport.
      expect(box.width).toBeGreaterThan(viewport.width * 0.9);
      expect(box.height).toBeGreaterThan(viewport.height * 0.9);
      expect(box.x).toBeLessThan(5);
      expect(box.y).toBeLessThan(5);
    }

    // Portaled directly under <body>, not nested inside the card's DOM subtree.
    const parentTag = await overlay.evaluate((el) => el.parentElement?.tagName);
    expect(parentTag).toBe('BODY');

    // Content is readable (not clipped/overlapping another sheet).
    await expect(page.locator('.detail-sheet-panel h2')).toContainText('Problem');

    // Close button: use force:true + toPass retry for the same reason as the trigger — under
    // parallel-suite load the panel's slide-up animation can still be running when Playwright
    // performs the actionability check, causing a "not stable" timeout in WebKit.
    const closeBtn = page.getByRole('button', { name: 'Close' });
    await expect(async () => {
      await closeBtn.click({ force: true });
      await expect(page.locator('.detail-sheet-overlay')).toBeHidden({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });

  });

  // Item 3 (2026-07-06 refinement): DetailSheet's close-effect used to fire on mount (open=false,
  // initial render), immediately focusing the trigger button and producing a spurious focus ring
  // on the More → buttons before any user interaction ("blue box roaming focus"). Fixed by tracking
  // wasOpened.current and only returning focus after an actual open-close cycle.
  test('no More button is focused on page load before user interaction', async ({ page }) => {
    await page.goto('/projects/felipetavares-dev', { waitUntil: 'networkidle' });

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return { tag: el.tagName, text: el.textContent?.trim() ?? '' };
    });

    // Either nothing is focused (body/null) or the focused element is not a "More →" trigger.
    if (focused) {
      expect(focused.text).not.toMatch(/more/i);
    }
  });

  test('also works on the Selfwright deep-dive (the other project with deepDive cards)', async ({ page }) => {
    // Complex deep-dive page + client:visible hydration needs more than the 30s default.
    test.setTimeout(60_000);

    await page.goto('/projects/selfwright', { waitUntil: 'networkidle' });

    // Scroll the first trigger into view to trigger client:visible hydration.
    await page.locator('[data-island="detail-sheet"]').first().scrollIntoViewIfNeeded();

    const triggers = page.locator('button:has-text("More")');
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);

    const first = triggers.nth(0);
    await expect(async () => {
      // Hydration check inside the retry — same pattern as the felipetavares-dev test above.
      await page.locator('[data-island="detail-sheet"][data-hydrated="true"]').first().waitFor({ timeout: 2_000 });
      await first.click();
      await expect(page.locator('.detail-sheet-overlay')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });

    const parentTag = await page.locator('.detail-sheet-overlay').evaluate((el) => el.parentElement?.tagName);
    expect(parentTag).toBe('BODY');
  });
});
