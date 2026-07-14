/**
 * Command palette (V3c commit 1) — pure data shaping + fuzzy-ish scoring, framework-free so it's
 * unit-testable without mounting the React island. The island (`src/components/islands/
 * CommandPalette.tsx`) builds the static `PaletteEntry[]` index once at render (from
 * `ContentRepository` + `src/config/nav.ts`/`site.ts`, passed down as a prop from an Astro
 * wrapper) and calls `scoreEntries` on every keystroke — no server round-trip, no search service.
 */

export type PaletteGroup = 'Pages' | 'Projects' | 'Writing' | 'Speaking' | 'Actions';

export interface PaletteEntry {
  id: string;
  group: PaletteGroup;
  title: string;
  subtitle?: string;
  /** Root-relative path to navigate to, e.g. "/projects/foo". Actions that don't navigate (e.g.
   *  "Copy email", "Toggle theme") omit this and are handled via `actionId` in the island instead. */
  href?: string;
  /** Identifies a non-navigation action for the island's switch statement (e.g. 'open-chat',
   *  'copy-email', 'toggle-theme', 'a11y-panel'). Mutually exclusive with `href` in practice. */
  actionId?: string;
}

/**
 * Tiny substring/subsequence scorer — no fuzzy-search dependency. Rationale: the index here tops
 * out at a few dozen entries (pages + projects + articles + talks + actions), so a full fuzzy
 * library (e.g. Fuse.js) would be a dependency for a problem this small; a simple scored substring
 * + in-order-subsequence match reads well for short titles and is easy to reason about/test.
 *
 * Scoring (higher is better; 0 = no match, entry excluded):
 *   - Exact substring match in the title: high score, boosted the earlier it appears.
 *   - Exact substring match in the subtitle: lower score.
 *   - In-order character subsequence match in the title (fuzzy typing, e.g. "cvpdf" -> "CV (PDF"):
 *     low score, scaled by how tightly the matched characters cluster.
 */
export function scoreEntry(query: string, entry: PaletteEntry): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const title = entry.title.toLowerCase();
  const subtitle = entry.subtitle?.toLowerCase() ?? '';

  const titleIdx = title.indexOf(q);
  if (titleIdx !== -1) {
    return 100 - titleIdx;
  }

  const subtitleIdx = subtitle.indexOf(q);
  if (subtitleIdx !== -1) {
    return 50 - subtitleIdx;
  }

  const subsequenceSpan = inOrderSubsequenceSpan(title, q);
  if (subsequenceSpan !== null) {
    return Math.max(1, 20 - subsequenceSpan);
  }

  return 0;
}

/** Returns the span (last match index - first match index) of the shortest window in `text` that
 *  contains every character of `query` in order, or null if `query` isn't a subsequence of `text`. */
function inOrderSubsequenceSpan(text: string, query: string): number | null {
  let qi = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (firstIdx === -1) firstIdx = ti;
      lastIdx = ti;
      qi++;
    }
  }
  if (qi < query.length) return null;
  return lastIdx - firstIdx;
}

/** Filters + sorts entries by descending score, stable on ties (original index order). */
export function scoreEntries(query: string, entries: PaletteEntry[]): PaletteEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(query, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.entry);
}

/** Groups already-sorted entries into the palette's section order, dropping empty groups. */
export function groupEntries(entries: PaletteEntry[]): { group: PaletteGroup; items: PaletteEntry[] }[] {
  const order: PaletteGroup[] = ['Pages', 'Projects', 'Writing', 'Speaking', 'Actions'];
  return order
    .map((group) => ({ group, items: entries.filter((e) => e.group === group) }))
    .filter((g) => g.items.length > 0);
}
