import { test, expect, type Page } from '@playwright/test';

// Wait for the CommandPalette island to finish hydrating before trying to open it.
// Under parallel-suite load, `client:idle` hydration can be delayed; the data-hydrated
// attribute (set in CommandPalette.tsx via useHydrationSignal) is the authoritative signal.
// Note: the wrapper div has `display:contents` (no bounding box) so we use state:'attached'
// rather than the default state:'visible', which requires a non-zero bounding box.
async function waitForPaletteReady(page: Page) {
  await page.locator('[data-island="command-palette"][data-hydrated="true"]').waitFor({ state: 'attached', timeout: 15_000 });
}

// CommandPalette is a `client:idle` island — retry the open action in case it lands just ahead of
// hydration (same pattern as navigation.spec.ts's MobileMenu test).
async function openViaShortcut(page: Page) {
  await waitForPaletteReady(page);
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(async () => {
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

async function openViaClick(page: Page) {
  await waitForPaletteReady(page);
  const trigger = page.getByRole('button', { name: 'Open command palette' });
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test.describe('command palette', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opens with Ctrl+K, filters, navigates, and Escape restores focus', async ({ page }) => {
    await page.goto('/');

    await openViaShortcut(page);

    const combobox = page.getByRole('combobox');
    await expect(combobox).toBeFocused();

    // Filter down to the Projects page.
    await combobox.fill('projects');
    const projectsOption = page.getByRole('option', { name: 'Projects', exact: true });
    await expect(projectsOption).toBeVisible();

    await projectsOption.click();
    await expect(page).toHaveURL(/\/projects\/?$/);
    await expect(page.locator('main h1')).toBeVisible();

    // Re-open (fresh page after navigation, so the island needs to rehydrate) and close via
    // Escape — focus should return to whatever had focus when it opened. Explicitly focus the
    // trigger button first (a keyboard user tabbing to it, or it already having focus) so the
    // "focus returns to the opener" assertion below has a deterministic starting point.
    const triggerAfterNav = page.getByRole('button', { name: 'Open command palette' });
    await triggerAfterNav.focus();
    await openViaShortcut(page);
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();
    await expect(triggerAfterNav).toBeFocused();
  });

  test('arrow keys move selection and Enter activates the highlighted result', async ({ page }) => {
    await page.goto('/');
    await openViaShortcut(page);

    const combobox = page.getByRole('combobox');
    await expect(combobox).toBeFocused();

    await combobox.fill('speaking');
    const option = page.getByRole('option', { name: 'Speaking', exact: true });
    await expect(option).toBeVisible();
    await expect(option).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/speaking\/?$/);
  });

  test('header trigger button opens the palette via click', async ({ page }) => {
    await page.goto('/');
    await openViaClick(page);
  });

  // V5a fix 6: wheel-over-the-palette used to scroll the PAGE behind it instead of the palette's
  // own results list. Reproduced on /experience, which has enough role-chapter content to scroll.
  // Scoped to pointer-capable projects (chromium + desktop webkit): Playwright's mobile-webkit
  // project emulates a touch device and does not support mouse.wheel() at all — the API throws
  // "Mouse wheel is not supported in mobile WebKit." Wheel scroll is a pointer-device interaction;
  // iOS users scroll via touch gestures, which are a separate code path and a separate test concern.
  test('wheel over the open palette scrolls its own list, not the page behind it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse.wheel not supported on mobile WebKit — touch-scroll is a separate code path');
    await page.goto('/experience');
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // Wait for island hydration before attempting to open the palette.
    await waitForPaletteReady(page);

    // Deliberately not `openViaShortcut`'s bare `toPass` retry here: retrying by unconditionally
    // re-pressing Ctrl+K can land WHILE the dialog is already open (a slow first check inside the
    // retry window), toggling it closed-then-open again — the open/close/open effect churn left a
    // brief window where Lenis was resumed between the first close and the second open, racing
    // this test's scroll-lock timing. Guarding each retry on the dialog being confirmed ABSENT
    // first makes every Ctrl+K press idempotent — it only ever opens, never toggles.
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(async () => {
      if (await dialog.isVisible()) return;
      await page.keyboard.press('Control+k');
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    const list = page.locator('.command-palette-list');
    await expect(list).toBeVisible();
    // Confirm the scroll-lock effect has actually committed (body.style.overflow flips
    // synchronously with it) before proceeding — the dialog can paint a tick before its mount
    // effect runs, so waiting on visibility alone raced the lock in a small fraction of runs.
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    // Baseline captured AFTER the palette is open and any residual Lenis inertia from the
    // open-shortcut interaction itself has settled — the meaningful comparison is "does wheeling
    // over the list move the page from wherever it already is once the palette is open," not
    // "from wherever it was before the palette existed" (opening can itself cost a few px of
    // inertia settling, which isn't the bug under test).
    await page.waitForTimeout(300);
    const scrollYBeforeListWheel = await page.evaluate(() => window.scrollY);

    const box = await list.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 1000);
    }
    // Give any (incorrectly) triggered Lenis inertia a moment to show up before asserting it
    // didn't move — an immediate read could pass even with the bug if Lenis's easing hadn't
    // ticked yet.
    await page.waitForTimeout(300);

    const scrollYWhileOpen = await page.evaluate(() => window.scrollY);
    expect(scrollYWhileOpen).toBe(scrollYBeforeListWheel);
  });
});
