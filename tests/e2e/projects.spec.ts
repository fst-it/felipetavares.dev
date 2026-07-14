import { test, expect } from '@playwright/test';

/**
 * Projects page e2e (H: /projects value-led redesign). Verifies:
 * - Cards lead with north star and outcomes at comfortable sizes (value content visible)
 * - InlineExpander ("How it's built") toggles between collapsed and expanded state
 * - Deep-dive links navigate to the project detail page
 * - PT locale page renders equivalent structure
 */
test.describe('/projects — value-led narrative cards', () => {
  test('shows north star text on each card', async ({ page }) => {
    await page.goto('/projects');

    // The Selfwright card north star is a known string seeded in content/projects/selfwright.mdx
    await expect(
      page.locator('text=A career operating system built on one constraint')
    ).toBeVisible();

    // The felipetavares.dev card north star
    await expect(
      page.locator('text=Proof that enterprise architectural discipline holds at personal-brand scale')
    ).toBeVisible();
  });

  test('outcomes list is visible on each card', async ({ page }) => {
    await page.goto('/projects');

    // Selfwright first outcome (seeded in selfwright.mdx)
    await expect(page.locator('text=passes a truth validator before it can be used')).toBeVisible();

    // felipetavares.dev first outcome (seeded in felipetavares-dev.mdx)
    await expect(page.locator('text=$0/month recurring cost')).toBeVisible();
  });

  test('InlineExpander toggles tech stack disclosure', async ({ page }) => {
    await page.goto('/projects');

    // There should be at least one InlineExpander trigger on the page
    const expander = page.locator('details.inline-expander').first();
    await expect(expander).toBeVisible();

    // Initially closed
    await expect(expander).not.toHaveAttribute('open');

    // Click to open
    const trigger = expander.locator('summary.inline-expander-trigger');
    await trigger.click();
    await expect(expander).toHaveAttribute('open', '');

    // Click to close
    await trigger.click();
    await expect(expander).not.toHaveAttribute('open');
  });

  test('deep-dive link navigates to the project detail page', async ({ page }) => {
    await page.goto('/projects');

    // Click the Selfwright deep-dive link
    const selfwrightCard = page.locator('[data-card-motion]').filter({ hasText: 'Selfwright' }).first();
    const deepDiveLink = selfwrightCard.getByRole('link', { name: /deep-dive/i });
    await deepDiveLink.click();

    await expect(page).toHaveURL(/\/projects\/selfwright\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
  });
});

test.describe('/pt/projects — PT locale value-led cards', () => {
  test('shows project cards with north star text', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/projects');

    // Project content is EN-only (V3d), but the card structure should be present
    await expect(
      page.locator('text=A career operating system built on one constraint')
    ).toBeVisible();
  });

  test('InlineExpander shows PT trigger label', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/projects');

    // The PT page uses strings.projectsPage.howItsBuilt = "Como foi construído"
    await expect(page.locator('summary.inline-expander-trigger').first()).toContainText('Como foi construído');
  });
});
