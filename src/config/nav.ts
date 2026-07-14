import type { Strings } from '../i18n';

export interface NavLink {
  label: string;
  href: string;
}

/** EN labels — kept as the historical default/fallback and as the shape `href`s are keyed by
 *  (see `localizedNav` below, which is what pages/components should actually render). */
export const primaryNav: NavLink[] = [
  { label: 'Experience', href: '/experience' },
  { label: 'Projects', href: '/projects' },
  { label: 'Writing', href: '/writing' },
  { label: 'Speaking', href: '/speaking' },
  { label: 'Contact', href: '/contact' },
];

export const bookACallHref = '/contact';

/** Locale-aware nav labels (V3d addendum) — `href`s stay unprefixed (locale prefixing happens at
 *  the render site via `localeToPathPrefix`), only the label text is translated. */
export function localizedNav(strings: Strings): NavLink[] {
  return [
    { label: strings.nav.experience, href: '/experience' },
    { label: strings.nav.projects, href: '/projects' },
    { label: strings.nav.writing, href: '/writing' },
    { label: strings.nav.speaking, href: '/speaking' },
    { label: strings.nav.contact, href: '/contact' },
  ];
}
