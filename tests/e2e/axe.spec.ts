import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// /projects/selfwright covers the new Problem/Approach/Architecture/Results DetailSheet
// cards (V3b addendum commit 1) — the site's first true modal-dialog interaction pattern.
// /pt/ removed from scan — PT-BR archived for v1 launch (ledger row 65); re-add when _pt is restored.
const PAGES = ['/', '/experience', '/contact', '/projects/selfwright'];

test.describe('axe accessibility scan', () => {
  for (const path of PAGES) {
    test(`${path} has no wcag2a/2aa/21aa violations`, async ({ page }) => {
      // Reduced motion avoids flakiness from in-flight scroll/hero animations affecting the
      // accessibility tree snapshot axe walks (spec: "Motion/animation-dependent assertions must
      // set localStorage.motion='off' first where animation would cause flakiness").
      await page.addInitScript(() => window.localStorage.setItem('motion', 'off'));
      // 'load' rather than 'networkidle': /contact embeds the Turnstile widget, whose
      // third-party script keeps background network activity going indefinitely.
      await page.goto(path, { waitUntil: 'load' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
