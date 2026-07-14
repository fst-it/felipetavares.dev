import { test, expect } from '@playwright/test';

// Spec 13.1 device matrix — representative widths from each bucket (mobile/tablet/laptop),
// checked against the pages named in the brief. 768 is also the exact width where the header's
// desktop-nav/mobile-menu breakpoint used to sit (pre-launch blocker: header overflowed here on
// both locales) — the header nav/CTA breakpoint now moves to lg (1024), so 768 falls into the
// mobile-menu range and must never overflow again.
const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
];

const PAGES = ['/', '/experience', '/projects/selfwright', '/contact'];

test.describe('responsive — no horizontal overflow', () => {
  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`${path} at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        // 'load' rather than 'networkidle': /contact embeds the Turnstile widget, whose
        // third-party script keeps background network activity going indefinitely and would
        // otherwise make this wait hang until timeout.
        await page.goto(path, { waitUntil: 'load' });

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
      });
    }
  }
});
