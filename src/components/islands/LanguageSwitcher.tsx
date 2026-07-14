import type { Locale } from '../../i18n';

export interface LanguageSwitcherProps {
  locale: Locale;
  /** Root-relative path to this same page's counterpart in the other locale (see
   *  BaseLayout.astro's `alternatePath` prop). When absent, this page has no translated
   *  counterpart in v1 (e.g. an individual EN-only article) — the switcher renders nothing rather
   *  than guessing a URL that doesn't exist. */
  alternatePath?: string;
  switchToLabel: string;
}

/**
 * Compact EN/PT language toggle (V3d addendum) — a plain `<a>` (server-renderable, works with
 * zero JS), not a client-side redirect. Deliberately NAVIGATES to the sibling route rather than
 * silently switching in place or auto-detecting the browser's language on load: predictable
 * behavior (the URL always reflects the language you're reading) and clean per-locale SEO (each
 * locale's pages are indexable at a stable, distinct URL) both depend on that. The one piece of
 * client state here — `localStorage('preferred-locale')` — exists only so other components (e.g.
 * a future "read this in your language" banner or CTA link) can consult a stored preference; nav-
 * link hrefs on the site never change based on it, and no redirect ever fires from it.
 *
 * Item 10 (2026-07-06 refinement): flag circle SVGs embedded inline (the target locale's flag:
 * GB for EN, BR for PT-BR). The island can't import the Astro CountryFlag component, so the
 * paths for the two flags used here are vendored directly from the same HatScripts/circle-flags
 * source as CountryFlag.astro. Only these two are needed; the others (NL, DE) live in
 * CountryFlag.astro for the Journey role chapters.
 */

/** Inline SVG for the GB (UK) circle flag — represents EN locale. */
function GbFlag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" aria-hidden="true" className="shrink-0 rounded-full">
      <mask id="ls-flag-gb"><circle cx="256" cy="256" r="256" fill="#fff"/></mask>
      <g mask="url(#ls-flag-gb)">
        <path fill="#eee" d="M0 0h512v512H0z"/>
        <path fill="#0052b4" d="M0 0v57.2L454.8 512H512v-57.2L57.2 0H0zm512 0v57.2L57.2 512H0v-57.2L454.8 0H512z"/>
        <path fill="#eee" d="M213.3 0v512h85.4V0h-85.4zM0 213.3v85.4h512v-85.4H0z"/>
        <path fill="#d80027" d="M0 0 180.2 0H0zM331.8 0H512v180.2L331.8 0zM0 331.8 0 512h180.2L0 331.8zm331.8 512L512 512v-180.2L331.8 512z"/>
        <path fill="#d80027" d="M0 213.3v85.4h512v-85.4H0zM213.3 0v512h85.4V0h-85.4z"/>
      </g>
    </svg>
  );
}

/** Inline SVG for the BR (Brazil) circle flag — represents PT-BR locale. */
function BrFlag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" aria-hidden="true" className="shrink-0 rounded-full">
      <mask id="ls-flag-br"><circle cx="256" cy="256" r="256" fill="#fff"/></mask>
      <g mask="url(#ls-flag-br)">
        <path fill="#6da544" d="M0 0h512v512H0z"/>
        <path fill="#ffda44" d="M256 100.2 467.5 256 256 411.8 44.5 256z"/>
        <path fill="#eee" d="M174.2 221a87 87 0 0 0-7.2 36.3l162 49.8a88.5 88.5 0 0 0 14.4-34c-40.6-65.3-119.7-80.3-169.1-52z"/>
        <path fill="#0052b4" d="M255.7 167a89 89 0 0 0-41.9 10.6 89 89 0 0 0-39.6 43.4 181.7 181.7 0 0 1 169.1 52.2 89 89 0 0 0-9-59.4 89 89 0 0 0-78.6-46.8zM212 250.5a149 149 0 0 0-45 6.8 89 89 0 0 0 10.5 40.9 89 89 0 0 0 120.6 36.2 89 89 0 0 0 30.7-27.3A151 151 0 0 0 212 250.5z"/>
      </g>
    </svg>
  );
}

export default function LanguageSwitcher({ locale, alternatePath, switchToLabel }: LanguageSwitcherProps) {
  if (!alternatePath) return null;

  const targetLocale: Locale = locale === 'en' ? 'pt-br' : 'en';

  function handleClick() {
    try {
      localStorage.setItem('preferred-locale', targetLocale);
    } catch {
      // localStorage unavailable (private browsing, etc.) — navigation below still proceeds.
    }
  }

  // The flag shown is the TARGET locale (what you'll switch TO), not the current one.
  const Flag = targetLocale === 'pt-br' ? BrFlag : GbFlag;
  const label = locale === 'en' ? 'PT' : 'EN';

  return (
    <a
      href={alternatePath}
      onClick={handleClick}
      aria-label={switchToLabel}
      lang={targetLocale === 'pt-br' ? 'pt-BR' : 'en'}
      hrefLang={targetLocale === 'pt-br' ? 'pt-BR' : 'en'}
      className="glass btn-interactive inline-flex min-h-11 w-[68px] items-center justify-center gap-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-[var(--text)] transition-colors duration-200 hover:text-[var(--accent)]"
    >
      <Flag />
      {label}
    </a>
  );
}
