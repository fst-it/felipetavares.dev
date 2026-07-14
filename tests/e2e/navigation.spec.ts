import { test, expect } from '@playwright/test';

const NAV_TARGETS = [
  { label: 'Experience', href: '/experience' },
  { label: 'Projects', href: '/projects' },
  { label: 'Writing', href: '/writing' },
  { label: 'Speaking', href: '/speaking' },
  { label: 'Contact', href: '/contact' },
];

test.describe('header navigation', () => {
  // The desktop primary nav (Header.astro) is `hidden md:flex` — only visible at >=768px.
  // Force a desktop viewport for these checks regardless of project (mobile-webkit's own
  // hamburger-menu test below covers small-viewport navigation).
  test.use({ viewport: { width: 1280, height: 800 } });

  test('header gains data-scrolled attribute when page scrolls past threshold', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    // At top-of-page: no data-scrolled (transparent floating-pill appearance).
    await expect(header).not.toHaveAttribute('data-scrolled');
    // Scroll well past the 16px threshold.
    await page.evaluate(() => window.scrollTo(0, 100));
    await expect(header).toHaveAttribute('data-scrolled', '');
  });

  test('nav pill gets high-opacity background when scrolled (contrast fix, row 90)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 100));
    // Wait for the scroll listener to set data-scrolled before checking the CSS transition.
    await expect(page.locator('header')).toHaveAttribute('data-scrolled', '');
    // Allow the 200ms background-color transition (--duration-micro) to settle.
    await page.waitForTimeout(300);
    // The pill is the first direct child <div> of <header> (the .glass element).
    // Its computed background-color alpha must exceed 0.75 so content behind it is not legible.
    const alpha = await page.locator('header > div').first().evaluate((el) => {
      const bg = window.getComputedStyle(el).backgroundColor;
      // Chromium serialises rgba(r, g, b, a) for partially-opaque colours; the 4th value is alpha.
      const m = bg.match(/rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)/);
      // No match means the browser returned the fully-opaque rgb(r,g,b) form — alpha is 1.
      return m ? parseFloat(m[1]) : 1;
    });
    expect(alpha).toBeGreaterThan(0.9);
  });

  for (const { label, href } of NAV_TARGETS) {
    test(`nav link "${label}" reaches ${href}`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${href}/?$`));
      await expect(page.locator('main h1')).toBeVisible();
    });
  }
});

test.describe('footer navigation', () => {
  // /engineering is deliberately off the primary header nav (kept lean) — its one sitewide
  // entry point besides the felipetavares.dev deep-dive pointer card is this footer link.
  test('footer "Engineering" link reaches /engineering', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Engineering' }).click();
    await expect(page).toHaveURL(/\/engineering\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How this site is actually built' })).toBeVisible();
  });
});

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('hamburger menu opens and navigates', async ({ page }) => {
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();

    // MobileMenu is a React island — retry the click in case it lands just ahead of hydration.
    const mobileNav = page.locator('#mobile-nav');
    await expect(async () => {
      await menuButton.click();
      await expect(mobileNav).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await mobileNav.getByRole('link', { name: 'Experience' }).click();
    await expect(page).toHaveURL(/\/experience\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
  });
});
