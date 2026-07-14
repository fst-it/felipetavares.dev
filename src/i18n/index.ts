import { en } from './en';
import { ptBr } from './pt-br';
import type { Strings } from './types';

export type { Strings } from './types';

/** Matches astro.config.mjs's `i18n.locales` mapped-path entry — the URL prefix is `pt`, the
 *  BCP-47 locale code (and this dictionary's key) is `pt-br`. */
export type Locale = 'en' | 'pt-br';

const dictionaries: Record<Locale, Strings> = {
  en,
  'pt-br': ptBr,
};

export const defaultLocale: Locale = 'en';

/** URL path prefix for a locale ('' for the default/unprefixed English root, '/pt' for PT-BR) —
 *  mirrors astro.config.mjs's i18n.locales mapping so callers never hardcode the prefix. */
export function localeToPathPrefix(locale: Locale): string {
  return locale === 'en' ? '' : '/pt';
}

/** Resolves a locale from Astro's `Astro.currentLocale` (which yields the BCP-47 code, e.g.
 *  "pt-br", for pages under /pt/, or "en" at the root) — falls back to the default locale for any
 *  unrecognized/undefined value rather than throwing, since a handful of routes (API routes, the
 *  llms.txt endpoints) call this without a real page locale in scope. */
export function resolveLocale(currentLocale: string | undefined): Locale {
  return currentLocale === 'pt-br' ? 'pt-br' : defaultLocale;
}

/**
 * Returns the typed string dictionary for a locale. Called from `.astro` files only — React
 * islands receive their slice of `Strings` as a prop instead of importing this directly, so every
 * island stays a pure function of its props with no client-side locale detection (see the V3d
 * addendum: "avoid client-side locale detection complexity").
 */
export function getStrings(locale: Locale): Strings {
  return dictionaries[locale];
}
