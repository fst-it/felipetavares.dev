import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test config — hits the LIVE site (or any URL in SMOKE_BASE_URL) without starting a local
 * server. Intended to be run after a Cloudflare Pages deployment to verify the live URL is
 * serving correctly. Separate from the main playwright.config.ts so `pnpm e2e` never touches the
 * live site unintentionally.
 *
 * Run: pnpm smoke
 * Override target: SMOKE_BASE_URL=https://felipetavares.dev pnpm smoke
 * Enable contact POST: SMOKE_CONTACT=1 SMOKE_BASE_URL=... pnpm smoke
 */
export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'https://felipetavares-dev.pages.dev',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — smoke tests run against the already-deployed live URL.
});
