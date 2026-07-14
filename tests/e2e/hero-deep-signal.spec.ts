import { test, expect } from '@playwright/test';

/**
 * Hero Deep Signal (Option 1b) — e2e coverage for the brain canvas island.
 *
 * Asserts: H1 and stats render; canvas present with motion on; canvas absent under
 * data-motion='off' (toggled via a11y panel); canvas wrapper hidden at 375px; fx
 * 'Off' removes canvas from DOM.
 */

test.describe('hero deep signal', () => {
  test('renders the site headline and kinetic line on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Owner decision 2026-07-07: the 1b placeholder text column was replaced by the site's own
    // hero copy (slogan/headline/kinetic/CTAs); only the brain canvas + backdrop stay from 1b.
    await expect(page.locator('main h1')).toContainText('Enterprise architecture');
    await expect(page.locator('.hero-ds-content')).toContainText('Architecting AI ambition');
  });

  test('canvas element present on desktop with motion on', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // BrainCanvas (client:visible) hydrates once the canvas wrapper enters the viewport.
    // At 1280px the wrapper is shown via CSS, so the island mounts and renders the canvas.
    await expect(page.locator('[data-brain-canvas]')).toBeAttached({ timeout: 15_000 });
  });

  test('canvas removed when Reduce Motion toggled off via a11y panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the engine to be fully running — data-brain-state="running" is set inside
    // the import().then() callback, AFTER useEffect has registered the motion subscriber.
    // This prevents a race where we click the switch before the subscriber is wired up.
    await expect(page.locator('[data-brain-canvas][data-brain-state="running"]')).toBeAttached({ timeout: 15_000 });

    // Wait for the AccessibilityPanel island to finish hydrating before clicking — data-hydrated
    // (set via useHydrationSignal on the badge button) is the authoritative signal.
    await page.locator('[data-island="a11y-panel"][data-hydrated="true"]').waitFor({ timeout: 15_000 });

    // Open a11y panel — client:idle island; retry until it hydrates.
    const badge = page.getByRole('button', { name: 'Accessibility settings' });
    const panel = page.getByRole('dialog', { name: 'Accessibility settings' });
    await expect(async () => {
      await badge.click();
      await expect(panel).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Toggle Reduce Motion on — sets html[data-motion='off'] and notifies BrainCanvas.
    const motionSwitch = panel.getByRole('switch', { name: 'Reduce motion' });
    await motionSwitch.click();
    await expect(motionSwitch).toHaveAttribute('aria-checked', 'true');

    // BrainCanvas must unmount the <canvas> element when motion is off.
    await expect(page.locator('[data-brain-canvas]')).not.toBeAttached({ timeout: 5_000 });

    // Reset: toggle motion back on so the state doesn't leak between tests.
    await motionSwitch.click();
  });

  test('mobile: dimmed brain background + legibility scrim at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Owner decision 2026-07-08: mobile shows the brain as a dimmed full-bleed background
    // (opacity .45) behind a legibility scrim, instead of hiding it.
    const wrap = page.locator('.hero-ds-canvas-wrap');
    await expect(wrap).toBeVisible();
    expect(Number(await wrap.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.6);
    await expect(page.locator('.hero-ds-scrim')).toBeVisible();
    // Text stays above the scrim and readable.
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('canvas removed when fx set to Off via a11y panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the engine to be fully running before changing fx preference.
    await expect(page.locator('[data-brain-canvas][data-brain-state="running"]')).toBeAttached({ timeout: 15_000 });

    // Wait for the AccessibilityPanel island to finish hydrating before clicking.
    await page.locator('[data-island="a11y-panel"][data-hydrated="true"]').waitFor({ timeout: 15_000 });

    // Open a11y panel.
    const badge = page.getByRole('button', { name: 'Accessibility settings' });
    const panel = page.getByRole('dialog', { name: 'Accessibility settings' });
    await expect(async () => {
      await badge.click();
      await expect(panel).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Click the "Off" option in the Visual effects segmented control.
    await panel.getByRole('radio', { name: 'Off' }).click();

    // Canvas must be removed from DOM.
    await expect(page.locator('[data-brain-canvas]')).not.toBeAttached({ timeout: 5_000 });

    // Reset fx to Auto so the preference doesn't leak.
    await panel.getByRole('radio', { name: 'Auto' }).click();
  });
});
