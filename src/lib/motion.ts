/**
 * Central motion kill-switch (addendum V2b, section 4 "Global guardrails" + section 9 gate:
 * "reduced-motion renders fully static"). Single source of truth: `html[data-motion]`, set
 * inline before first paint (see BaseLayout's no-flash script) from `prefers-reduced-motion`,
 * overridable via `localStorage.motion` so the V2c a11y panel can flip it later without any
 * changes here.
 *
 * Every motion entry point (islands, Astro `<script>` blocks, CSS) must check this — either via
 * `motionEnabled()`/`subscribeMotion()` in JS, or the `html[data-motion="off"]` attribute selector
 * in CSS (see effects.css).
 */

export type MotionPreference = 'on' | 'off';

const STORAGE_KEY = 'motion';
const DATA_ATTR = 'data-motion';

/** Reads the resolved state straight off the `<html>` element — no media-query re-check, since
 * the inline no-flash script already resolved localStorage vs. `prefers-reduced-motion` once. */
export function motionEnabled(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.getAttribute(DATA_ATTR) !== 'off';
}

/** Persists an explicit override and updates the live attribute so every open tab's next read
 * of `motionEnabled()` picks it up immediately (subscribers are notified via the callback list). */
export function setMotionOverride(preference: MotionPreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(DATA_ATTR, preference);
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // localStorage unavailable (private browsing, etc.) — override just won't persist.
  }
  for (const cb of subscribers) cb(preference === 'on');
}

const subscribers = new Set<(enabled: boolean) => void>();

/** Subscribes to motion-preference changes made via `setMotionOverride` (same-tab only — this is
 * not a `storage` event listener, since the only writer in-app is the toggle itself). Returns an
 * unsubscribe function. */
export function subscribeMotion(callback: (enabled: boolean) => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
