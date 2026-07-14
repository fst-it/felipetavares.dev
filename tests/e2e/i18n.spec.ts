import { test, expect } from '@playwright/test';

/**
 * i18n e2e coverage (V3d addendum commit 3): language switcher navigation both directions on Home
 * and one deep page, PT Home renders PT copy, hreflang tags present both directions, and no
 * horizontal overflow on the PT Home at a narrow viewport (mirrors the existing responsive.spec.ts
 * pattern for the EN pages).
 *
 * NOTE (ledger row 65): PT-BR archived for v1 launch — _pt directory excludes PT routes from the
 * build; all tests that visit /pt/* or check PT hreflang alternates are skipped until _pt is
 * restored to pages/pt and the language toggle is re-added to the header.
 */
test.describe('i18n — language switcher', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('switches EN Home -> PT Home and back', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();

    const toPt = page.getByRole('link', { name: 'Ler em português' });
    await toPt.click();
    await expect(page).toHaveURL(/\/pt\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    // Verify the "Read in English" switcher is present (locale-specific indicator).
    await expect(page.getByRole('link', { name: 'Read in English' })).toBeVisible();

    const toEn = page.getByRole('link', { name: 'Read in English' });
    await toEn.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // Verify the "Ler em português" switcher is present (locale-specific indicator).
    await expect(page.getByRole('link', { name: 'Ler em português' })).toBeVisible();
  });

  test('switches EN Journey -> PT Journey and back', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/experience');
    await expect(page.locator('main h1')).toBeVisible();

    await page.getByRole('link', { name: 'Ler em português' }).click();
    await expect(page).toHaveURL(/\/pt\/experience\/?$/);
    await expect(page.locator('main h1')).toHaveText('A história por trás da arquitetura');

    await page.getByRole('link', { name: 'Read in English' }).click();
    await expect(page).toHaveURL(/\/experience\/?$/);
    await expect(page.locator('main h1')).toHaveText('The story behind the architecture');
  });
});

test.describe('i18n — PT Home rendering', () => {
  test('renders h1 and locale switcher', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/');
    // Both locales share the same HeroDeepSignal hero; verify h1 and the PT locale indicator.
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read in English' })).toBeVisible();
  });

  test('no horizontal overflow at 375px', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/pt/', { waitUntil: 'load' });

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
});

test.describe('i18n — hreflang', () => {
  test('EN Home has both hreflang alternates', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    // (hreflang alternate to /pt/ removed from EN pages to avoid pointing at 404 routes)
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://felipetavares.dev/');
    await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', 'https://felipetavares.dev/pt/');
  });

  test('PT Home has both hreflang alternates', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://felipetavares.dev/');
    await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', 'https://felipetavares.dev/pt/');
  });
});

// Item 9 (2026-07-06 refinement): switching locale must not change structural component sizes.
// Header height must be equal at 1280px between / and /pt/ — the header is locale-invariant
// (same logo, same nav links). The hero section height is allowed to differ because the PT
// positioning statement is longer than EN and wraps differently; we verify padding consistency
// instead (both heroes share the same Tailwind padding classes).
test.describe('i18n — layout stability across locales', () => {
  test('header height is equal between / and /pt/ at 1280px', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/', { waitUntil: 'networkidle' });
    const enHeader = await page.locator('header').first().boundingBox();

    await page.goto('/pt/', { waitUntil: 'networkidle' });
    const ptHeader = await page.locator('header').first().boundingBox();

    expect(enHeader).not.toBeNull();
    expect(ptHeader).not.toBeNull();

    if (enHeader && ptHeader) {
      // Allow ±2px for subpixel rounding differences across locales.
      expect(Math.abs(enHeader.height - ptHeader.height)).toBeLessThanOrEqual(2);
    }
  });
});

// /pt/writing (pre-launch blocker fix): the nav link existed before the route did, so it 404'd.
// Mirrors the /pt/projects pattern — PT chrome, EN-only article cards with an "in English" badge,
// unprefixed EN tag links — covered here with a switcher round-trip plus hreflang, matching the
// bar set for the Home/Journey pairs above.
test.describe('i18n — PT Writing', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('switches EN Writing -> PT Writing and back', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/writing');
    await expect(page.locator('main h1')).toBeVisible();

    await page.getByRole('link', { name: 'Ler em português' }).click();
    await expect(page).toHaveURL(/\/pt\/writing\/?$/);
    await expect(page.locator('main h1')).toHaveText('Arquitetura, IA e liderança em uma estrutura matricial global');

    await page.getByRole('link', { name: 'Read in English' }).click();
    await expect(page).toHaveURL(/\/writing\/?$/);
    await expect(page.locator('main h1')).toHaveText('Architecture, AI, and leading through a global matrix');
  });

  test('PT Writing renders PT h1 and an EN-language badge on article cards', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    const response = await page.goto('/pt/writing');
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveText('Arquitetura, IA e liderança em uma estrutura matricial global');
    await expect(page.getByText('em inglês').first()).toBeVisible();
  });

  test('PT Writing has both hreflang alternates', async ({ page }) => {
    // PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored
    test.skip(true, 'PT-BR archived for v1 launch — see ledger row 65; re-enable when _pt is restored');
    await page.goto('/pt/writing');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://felipetavares.dev/writing');
    await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', 'https://felipetavares.dev/pt/writing');
  });
});
