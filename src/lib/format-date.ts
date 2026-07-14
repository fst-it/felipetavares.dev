import type { Locale } from '../i18n';

function localeTag(locale: Locale): string {
  return locale === 'pt-br' ? 'pt-BR' : 'en-US';
}

/**
 * Card/list date format ("Jul 5, 2026" / "5 de jul. de 2026") — used on writing index cards
 * (EN, PT chrome, and the Home "Latest writing" strip) and the featured-article card. Cached per
 * locale since `Intl.DateTimeFormat` construction isn't free and every caller re-renders per item.
 */
const cardFormatters = new Map<Locale, Intl.DateTimeFormat>();
export function formatCardDate(date: Date, locale: Locale = 'en'): string {
  let formatter = cardFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(localeTag(locale), { month: 'short', day: 'numeric', year: 'numeric' });
    cardFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

/** Full article date format ("July 5, 2026") — used on the article page itself. */
const longFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
export function formatLongDate(date: Date): string {
  return longFormatter.format(date);
}

/**
 * Month/year format ("Jul 2026" / "jul. de 2026") for role periods (dossier + Journey chapters),
 * parsed from this site's "YYYY-MM" role date strings.
 */
const monthYearFormatters = new Map<Locale, Intl.DateTimeFormat>();
export function formatMonthYear(value: string, locale: Locale = 'en'): string {
  let formatter = monthYearFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(localeTag(locale), { month: 'short', year: 'numeric' });
    monthYearFormatters.set(locale, formatter);
  }
  const [year, month] = value.split('-').map(Number);
  return formatter.format(new Date(year, (month ?? 1) - 1));
}
