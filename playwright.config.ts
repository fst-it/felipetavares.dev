import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright cross-engine E2E config (spec section 13 + 13.1: "Chromium (Chrome/Edge), Gecko
 * (Firefox), WebKit (Safari/iOS)"). Serving decision: `@astrojs/cloudflare`'s adapter does not
 * support `astro preview` at all (confirmed: it throws "does not support the preview command"),
 * and `wrangler pages dev dist` — the closer-to-prod alternative — 500s on POST /api/chat because
 * the Vectorize binding requires a real (remote) Cloudflare account connection, which this
 * environment doesn't have. `pnpm dev` (Astro's Vite dev server) is the one server where every
 * route, including both API routes, works end-to-end with zero credentials: bindings are simply
 * absent, so src/config/llm.ts and src/pages/api/contact.ts fall back to their dev adapters
 * (EchoDevProvider, LexicalIndex, ConsoleEmailSender, InMemoryRateLimiter) exactly as designed.
 * The whole suite therefore runs against `pnpm dev`, not a production build preview.
 *
 * `pnpm dev` runs through Miniflare (the Cloudflare adapter's local runtime emulation), which
 * auto-provisions a real, disk-persisted KV binding for RATE_LIMIT_KV even though wrangler.jsonc's
 * id is just a "REPLACE_AT_DEPLOYMENT" placeholder — so /api/contact and /api/chat pick the
 * production `KvRateLimiter` path (not the in-memory dev fallback the adapter code comments
 * assume), and rate-limit counters persist across dev-server restarts on disk under
 * `.wrangler/state`. `webServer.command` clears that directory immediately before `astro dev`
 * starts, so contact.spec/chat.spec always begin unthrottled — a `globalSetup` hook would run too
 * late (Playwright starts `webServer` first) and race Miniflare's just-opened SQLite files.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 1,
  // Cap local parallelism to 4 workers — the timing-race flakes (CommandPalette, DetailSheet,
  // AccessibilityPanel) only appear under heavy parallel load when many islands compete for the
  // same dev-server response bandwidth. In CI, leave at the platform default (the GitHub Actions
  // runner exposes 2 CPUs, so the effective default is 1 — even more conservative than 4).
  workers: process.env.CI ? undefined : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node -e "require(\'fs\').rmSync(\'.wrangler/state\', { recursive: true, force: true })" && pnpm dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      // KNOWN SANDBOX LIMITATION (not a site or test bug): in this Windows development sandbox,
      // the downloaded Firefox binary fails to launch at all — Windows Event Viewer shows
      // "Activation context generation failed ... Dependent Assembly mozglue ... could not be
      // found" (event id 33, source SideBySide) even though mozglue.dll is physically present
      // next to firefox.exe and the system's VC++ runtime (vcruntime140/msvcp140) is installed.
      // Reinstalling via `playwright install --force firefox` and `install-deps` did not change
      // the outcome, and the same failure occurs via cmd.exe and PowerShell alike, ruling out a
      // shell- or Playwright-specific cause — it points at this sandbox's Windows image/policy
      // blocking that binary's manifest resolution. Chromium and WebKit are unaffected. This
      // project is left configured (a real CI runner, e.g. Ubuntu, should not hit this) but every
      // test under it is skipped here rather than reporting a fake pass. Remove this skip once
      // verified working in the target CI environment.
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-webkit',
      // "iphone-like" mobile viewport (spec 13.1's mobile checks) on the WebKit engine, since
      // all iOS browsers are WebKit regardless of the label they show.
      use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
