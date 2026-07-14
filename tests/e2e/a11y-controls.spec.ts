import { test, expect } from '@playwright/test';

test.describe('accessibility control center', () => {
  test('badge visible bottom-left', async ({ page }) => {
    await page.goto('/');

    const badge = page.getByRole('button', { name: 'Accessibility settings' });
    await expect(badge).toBeVisible();

    const box = await badge.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    if (box && viewport) {
      expect(box.x).toBeLessThan(viewport.width * 0.3);
      expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.5);
    }
  });

  test('reduce-motion toggle sets html[data-motion=off] and persists after reload', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-motion', 'on');

    // Wait for the AccessibilityPanel island to finish hydrating before clicking the badge —
    // data-hydrated (set via useHydrationSignal on the badge button) is the authoritative signal.
    await page.locator('[data-island="a11y-panel"][data-hydrated="true"]').waitFor({ timeout: 15_000 });
    const badge = page.getByRole('button', { name: 'Accessibility settings' });
    const panel = page.getByRole('dialog', { name: 'Accessibility settings' });
    await expect(async () => {
      await badge.click();
      await expect(panel).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await panel.getByRole('switch', { name: 'Reduce motion' }).click();

    await expect(html).toHaveAttribute('data-motion', 'off');

    await page.reload();
    await expect(html).toHaveAttribute('data-motion', 'off');
  });

  test('larger-text toggle changes root font-size', async ({ page }) => {
    await page.goto('/');

    const getRootFontSize = () =>
      page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

    const before = await getRootFontSize();

    await page.locator('[data-island="a11y-panel"][data-hydrated="true"]').waitFor({ timeout: 15_000 });
    const badge = page.getByRole('button', { name: 'Accessibility settings' });
    const panel = page.getByRole('dialog', { name: 'Accessibility settings' });
    await expect(async () => {
      await badge.click();
      await expect(panel).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await panel.getByRole('switch', { name: 'Larger text' }).click();

    const after = await getRootFontSize();
    expect(after).toBeGreaterThan(before);
  });
});
