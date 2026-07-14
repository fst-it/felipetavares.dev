/**
 * Maps a role's `location` field to a CountryFlag country code (V5a fix 3d, single-definition
 * policy). Extracted from RoleChapter.astro so the detailed view and the summary view share one
 * implementation. Portugal added alongside the original 3 (Brazil, Netherlands, Germany) to
 * support the Siemens dual-location (Lisbon, PT · Munich, DE).
 *
 * Patterns match both ISO 3166-1 alpha-2 codes (e.g. "BR", "NL") and legacy full-name strings
 * (e.g. "Brazil") so any old cached data or external consumers aren't silently misread.
 *
 * Returns null for any location this map doesn't recognize — the flag is decorative, so an
 * unmapped location simply renders without one rather than guessing wrong.
 */
export function countryCodeForLocation(location: string): 'br' | 'nl' | 'de' | 'pt' | null {
  if (/brazil|\bBR\b/i.test(location)) return 'br';
  if (/netherlands|\bNL\b/i.test(location)) return 'nl';
  if (/germany|\bDE\b/i.test(location)) return 'de';
  if (/portugal|\bPT\b/i.test(location)) return 'pt';
  return null;
}
