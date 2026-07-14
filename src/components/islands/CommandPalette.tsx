import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { motionEnabled } from '../../lib/motion';
import { useScrollLock } from '../../lib/scroll-lock';
import { toggleTheme } from '../../lib/theme';
import { groupEntries, scoreEntries, type PaletteEntry, type PaletteGroup } from '../../core/services/command-palette';
import type { Strings } from '../../i18n';
import { useHydrationSignal } from '../../lib/use-hydration-signal';

export interface CommandPaletteProps {
  /** Static index built server-side at render (ContentRepository + nav config) — see
   *  `src/components/astro/CommandPaletteMount.astro`. Never fetched client-side. */
  entries: PaletteEntry[];
  /** commandPalette-slice of the locale dictionary (V3d addendum) for the palette's own chrome
   *  (placeholder, group labels, "no matches"). Entry titles/subtitles are baked into `entries`
   *  server-side and stay EN in v1 for project/article entries per the site's translation scope. */
  strings: Strings['commandPalette'];
  /** `siteConfig.contactEmail`, passed down from `CommandPaletteMount.astro` so this island reads
   *  the single-defined config value instead of holding its own copy of the address. */
  contactEmail: string;
}

/** Dispatched by the header trigger button's inline script (Header.astro); any other component
 *  can open the palette the same way (mirrors `fst:open-chat`, see ChatWidget.tsx). */
export const OPEN_EVENT = 'fst:open-palette';

function runAction(actionId: string, contactEmail: string) {
  switch (actionId) {
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'a11y-panel':
      window.dispatchEvent(new CustomEvent('fst:open-a11y'));
      break;
    case 'open-chat':
      window.dispatchEvent(new CustomEvent('fst:open-chat'));
      break;
    case 'copy-email':
      navigator.clipboard?.writeText(contactEmail).catch(() => {
        // Clipboard API unavailable/denied — no-op; the email is still visible on /contact.
      });
      break;
    default:
      break;
  }
}

/** Maps a `PaletteGroup` to its translated section-heading label. */
function groupLabel(group: PaletteGroup, strings: Strings['commandPalette']): string {
  switch (group) {
    case 'Pages':
      return strings.groups.pages;
    case 'Projects':
      return strings.groups.projects;
    case 'Writing':
      return strings.groups.writing;
    case 'Speaking':
      return strings.groups.speaking;
    case 'Actions':
      return strings.groups.actions;
    default:
      return group;
  }
}

/**
 * Command palette island (V3c commit 1) — `Ctrl/Cmd+K` power-user navigation + actions. Static
 * index built server-side (no server round-trip, no external search service); filtering runs the
 * in-house scorer from `src/core/services/command-palette.ts` on every keystroke.
 *
 * A11y pattern: combobox + listbox (WAI-ARIA APG "Combobox with List Autocomplete"), same
 * hand-rolled focus-trap/Escape-returns-focus approach as `DetailSheet`/`AccessibilityPanel` for
 * consistency across the codebase, rather than a third pattern. Motion-off renders with no
 * transition (instant open/close), per the site's global kill-switch rule.
 *
 * Lazy-loaded (`client:idle`, mounted via `CommandPaletteMount.astro`). Both open paths — the
 * header's server-rendered trigger button and the global Ctrl/Cmd+K shortcut (BaseLayout.astro's
 * inline script) — dispatch `OPEN_EVENT` rather than touching this component's state directly, so
 * clicking/pressing the shortcut still queues the open intent even before this island hydrates,
 * the same "static shell" trick already used for the chat launcher / a11y badge.
 */
export default function CommandPalette({ entries, strings, contactEmail }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const listboxId = useId();
  const labelId = useId();

  // Hydration signal — lets E2E tests wait for this island before interacting.
  useHydrationSignal(rootRef);

  const filtered = useMemo(() => scoreEntries(query, entries), [query, entries]);
  const grouped = useMemo(() => groupEntries(filtered), [filtered]);
  const flatIds = useMemo(() => filtered.map((e) => e.id), [filtered]);

  // Open via the custom event — the single source of truth for "open the palette", dispatched by
  // both the header trigger button's click handler AND the global Ctrl/Cmd+K listener, which lives
  // in BaseLayout.astro's inline script rather than here. Keeping the shortcut in one place (rather
  // than duplicating a second `document.addEventListener('keydown', ...)` in this island) avoids a
  // double-toggle race: with two independent listeners on the same keydown, one setting `open` via
  // the event and the other calling `setOpen(o => !o)` directly, a single Ctrl+K press ends up
  // opening and immediately re-closing the panel in the same tick once this island has hydrated.
  useEffect(() => {
    function handleOpen() {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  // Body scroll lock while open (shared with DetailSheet — src/lib/scroll-lock.ts).
  useScrollLock(open);

  // Reset transient state whenever the palette opens; focus the input; Escape closes regardless of
  // which element inside the panel currently has focus (mirrors DetailSheet's document-level
  // Escape handling, rather than relying solely on the input's own onKeyDown).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());

    function handleDocumentKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [open]);

  // Return focus to whatever triggered the open once it closes.
  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  // Clamp active index whenever the result set changes.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, flatIds.length - 1)));
  }, [flatIds]);

  function activate(entry: PaletteEntry) {
    setOpen(false);
    if (entry.href) {
      window.location.href = entry.href;
    } else if (entry.actionId) {
      runAction(entry.actionId, contactEmail);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Escape is handled document-wide by the effect above (works regardless of focus location).
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatIds.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = filtered[activeIndex];
      if (entry) activate(entry);
      return;
    }
    if (e.key === 'Tab') {
      // Single-field combobox: keep focus in the input rather than trapping Tab (no other
      // focusable elements inside the panel besides the result list, which is not tab-stoppable
      // by design per the combobox pattern — arrow keys own list navigation).
      e.preventDefault();
    }
  }

  const instant = !motionEnabled();

  // `display: contents` makes the wrapper div invisible to layout (no box generated) while still
  // hosting the ref for the hydration signal and preserving the island's existing fragment output.
  return (
    <div ref={rootRef} data-island="command-palette" style={{ display: 'contents' }}>
      {/* No trigger button rendered here — Header.astro server-renders the visible trigger button
          (so it's present with no pop-in) and dispatches the same OPEN_EVENT this island listens
          for below; this island owns only the dialog itself. */}
      {open && (
        <div
          className="command-palette-overlay"
          data-instant={instant || undefined}
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            className="command-palette-panel overlay-surface glass"
            data-instant={instant || undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={labelId} className="sr-only">
              {strings.dialogTitle}
            </h2>
            <div className="flex items-center gap-3 border-b border-[var(--border-glass)] px-4 py-3">
              <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={flatIds[activeIndex] ? `palette-option-${flatIds[activeIndex]}` : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={strings.placeholder}
                className="min-h-11 w-full bg-transparent text-base text-[var(--text)] placeholder:text-muted focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded border border-[var(--border-glass)] px-1.5 py-0.5 font-mono text-xs text-muted sm:inline">
                Esc
              </kbd>
            </div>

            {/* `data-lenis-prevent` (V5a fix 6) is Lenis's own documented escape hatch for nested
                scrollable regions — belt-and-suspenders alongside `useScrollLock`'s
                pauseSmoothScroll()/resumeSmoothScroll() calls (src/lib/scroll-lock.ts): Lenis
                checks this attribute on every wheel event's composed path and, when present,
                ignores the event unconditionally regardless of its own stop/start state, so this
                list's own native scroll is never at the mercy of stop()/start() timing. */}
            <ul
              id={listboxId}
              role="listbox"
              aria-label={strings.resultsLabel}
              className="command-palette-list"
              data-lenis-prevent
            >
              {grouped.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted">{strings.noMatches}</li>
              )}
              {grouped.map((section) => (
                <li key={section.group}>
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    {groupLabel(section.group, strings)}
                  </p>
                  <ul>
                    {section.items.map((entry) => {
                      const index = flatIds.indexOf(entry.id);
                      const active = index === activeIndex;
                      return (
                        <li key={entry.id}>
                          <button
                            id={`palette-option-${entry.id}`}
                            role="option"
                            aria-selected={active}
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => activate(entry)}
                            className={`flex min-h-11 w-full flex-col items-start gap-0.5 px-4 py-2 text-left transition-colors duration-100 ${
                              active ? 'bg-[var(--surface-glass-strong)] text-[var(--text)]' : 'text-muted'
                            }`}
                          >
                            <span className="text-sm font-medium">{entry.title}</span>
                            {entry.subtitle && <span className="text-xs opacity-80">{entry.subtitle}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <style>{`
        .command-palette-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgb(0 0 0 / 50%);
          animation: command-palette-fade var(--duration-micro, 200ms) var(--ease-out, ease-out);
        }

        .command-palette-overlay[data-instant] {
          animation: none;
        }

        .command-palette-panel {
          display: flex;
          width: 100%;
          max-height: 80vh;
          flex-direction: column;
          overflow: hidden;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          animation: command-palette-slide-up var(--duration-reveal, 400ms) var(--ease-out, ease-out);
        }

        .command-palette-panel[data-instant] {
          animation: none;
        }

        .command-palette-list {
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-bottom: 0.5rem;
        }

        @media (min-width: 640px) {
          .command-palette-overlay {
            align-items: flex-start;
            padding-top: 12vh;
          }

          .command-palette-panel {
            width: min(100%, 560px);
            max-height: 70vh;
            border-radius: var(--radius-lg);
            animation: command-palette-pop var(--duration-micro, 200ms) var(--ease-out, ease-out);
          }
        }

        @keyframes command-palette-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes command-palette-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @keyframes command-palette-pop {
          from { opacity: 0; transform: scale(0.97) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .command-palette-overlay,
          .command-palette-panel {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
