import { test, expect } from '@playwright/test';

/**
 * Galaxy backdrop E2E assertions (Commit 3).
 *
 * GalaxyBackdrop mounts client:idle and overlays Starfield when motion is on.
 * When data-motion="off" the component returns null; Starfield shows through.
 */
test.describe('galaxy backdrop', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'firefox', 'firefox quarantined');
  });

  test('galaxy canvas present on desktop with motion on', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure motion is on (default)
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-motion');
      document.documentElement.setAttribute('data-motion', 'on');
    });

    // GalaxyBackdrop mounts client:idle — wait for the data-galaxy-canvas element
    await expect(page.locator('[data-galaxy-canvas]')).toBeVisible({ timeout: 15_000 });
  });

  test('galaxy canvas absent when data-motion=off (Starfield fallback)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Set motion=off in localStorage BEFORE navigation so the no-flash script
    // initialises data-motion="off" before the GalaxyBackdrop island mounts.
    // (subscribeMotion uses an in-memory Set; direct attribute mutation after mount
    // does not trigger subscriber callbacks, so pre-setting localStorage is required.)
    await page.addInitScript(() => {
      localStorage.setItem('motion', 'off');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // GalaxyBackdrop returns null when motion off — element must not exist
    await expect(page.locator('[data-galaxy-canvas]')).not.toBeAttached({ timeout: 10_000 });
  });

  test('galaxy uses mobile props at 375px (data-galaxy-mobile present)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure motion on
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-motion', 'on');
    });

    // Wait for galaxy to mount
    await expect(page.locator('[data-galaxy-canvas]')).toBeVisible({ timeout: 15_000 });

    // Mobile variant adds data-galaxy-mobile attribute
    await expect(page.locator('[data-galaxy-mobile]')).toBeAttached({ timeout: 5_000 });
  });
});
