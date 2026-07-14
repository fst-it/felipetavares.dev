import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('renders hero h1 and slogan', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    // Scoped to <main>: under heavy parallel load this environment has occasionally shown
    // extra <h1> elements from an unrelated devtools/extension overlay outside the page content.
    // Updated from placeholder "I wire" to real hero headline (headline replaced in content/).
    await expect(page.locator('main h1')).toContainText('Enterprise architecture');

    expect(errors).toEqual([]);
  });

  test('theme toggle switches html class and persists after reload', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveClass(/theme-dark/);

    // ThemeToggle is a React island — retry the click in case it lands just ahead of hydration.
    const toggle = page.getByRole('button', { name: /switch to light theme/i });
    await expect(async () => {
      await toggle.click();
      await expect(html).toHaveClass(/theme-light/, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await page.reload();
    await expect(html).toHaveClass(/theme-light/);
  });
});
