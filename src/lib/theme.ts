/**
 * Central theme read/write (mirrors `motion.ts`'s pattern). Single source of truth:
 * `html.theme-dark`/`html.theme-light`, set inline before first paint (see BaseLayout's no-flash
 * script) from `localStorage`, falling back to dark. Every theme-writing entry point (ThemeToggle,
 * CommandPalette's "toggle theme" action) must go through `setTheme` rather than touching the
 * class list / localStorage key directly.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

/** Reads the resolved theme straight off the `<html>` element's class list. */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
}

/** Applies a theme to `<html>` and persists it, so the no-flash script picks it up next load. */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('theme-dark', 'theme-light');
  document.documentElement.classList.add(`theme-${theme}`);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (private browsing, etc.) — theme just won't persist.
  }
}

/** Flips the current theme and returns the new value. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
