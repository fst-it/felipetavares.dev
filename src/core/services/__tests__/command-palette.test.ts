import { describe, it, expect } from 'vitest';
import { scoreEntry, scoreEntries, groupEntries, type PaletteEntry } from '../command-palette';

const entries: PaletteEntry[] = [
  { id: 'nav-projects', group: 'Pages', title: 'Projects', href: '/projects' },
  { id: 'nav-experience', group: 'Pages', title: 'Experience', href: '/experience' },
  { id: 'project-foo', group: 'Projects', title: 'Foo Platform', subtitle: 'Data platform rebuild', href: '/projects/foo' },
  { id: 'article-bar', group: 'Writing', title: 'Bar Architecture', subtitle: 'A deep dive on Bar', href: '/writing/bar' },
  { id: 'action-cv', group: 'Actions', title: 'Download CV (PDF print)', actionId: 'download-cv' },
  { id: 'action-email', group: 'Actions', title: 'Copy email', actionId: 'copy-email' },
];

describe('scoreEntry', () => {
  it('returns a positive score for every entry on an empty query', () => {
    for (const entry of entries) {
      expect(scoreEntry('', entry)).toBeGreaterThan(0);
    }
  });

  it('scores an exact title substring highest, boosted by earlier position', () => {
    const early = scoreEntry('proj', { id: 'a', group: 'Pages', title: 'Projects' });
    const late = scoreEntry('proj', { id: 'b', group: 'Pages', title: 'My Projects' });
    expect(early).toBeGreaterThan(late);
  });

  it('scores a subtitle match lower than a title match', () => {
    const titleMatch = scoreEntry('foo', entries[2]); // "Foo Platform"
    const subtitleOnly = scoreEntry('rebuild', entries[2]); // only in subtitle
    expect(titleMatch).toBeGreaterThan(subtitleOnly);
    expect(subtitleOnly).toBeGreaterThan(0);
  });

  it('matches an in-order subsequence (fuzzy typing) in the title', () => {
    const score = scoreEntry('cvpdf', entries[4]); // "Download CV (PDF print)"
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for a query that matches nothing', () => {
    expect(scoreEntry('zzzzz', entries[0])).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(scoreEntry('PROJ', entries[0])).toBeGreaterThan(0);
  });
});

describe('scoreEntries', () => {
  it('filters out non-matching entries and sorts by descending score', () => {
    const result = scoreEntries('platform', entries);
    expect(result.map((e) => e.id)).toEqual(['project-foo']);
  });

  it('matches the nav entry by its own title substring', () => {
    const result = scoreEntries('proj', entries);
    expect(result.map((e) => e.id)).toEqual(['nav-projects']);
  });

  it('returns every entry, in original order, for an empty query', () => {
    const result = scoreEntries('', entries);
    expect(result).toEqual(entries);
  });

  it('returns an empty array when nothing matches', () => {
    expect(scoreEntries('qqqqqqq', entries)).toEqual([]);
  });
});

describe('groupEntries', () => {
  it('groups in the fixed section order and drops empty groups', () => {
    const grouped = groupEntries(entries);
    expect(grouped.map((g) => g.group)).toEqual(['Pages', 'Projects', 'Writing', 'Actions']);
  });

  it('keeps all items for a populated group', () => {
    const grouped = groupEntries(entries);
    const actions = grouped.find((g) => g.group === 'Actions');
    expect(actions?.items.map((i) => i.id)).toEqual(['action-cv', 'action-email']);
  });

  it('omits Speaking when no talks are present', () => {
    const grouped = groupEntries(entries);
    expect(grouped.some((g) => g.group === 'Speaking')).toBe(false);
  });
});
