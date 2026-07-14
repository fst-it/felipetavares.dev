import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motionEnabled } from '../../lib/motion';
import { useScrollLock } from '../../lib/scroll-lock';
import { useHydrationSignal } from '../../lib/use-hydration-signal';

export interface DetailSheetProps {
  /** Trigger label, e.g. "More →". Rendered as a button that opens the sheet. */
  triggerLabel: string;
  /** Sheet heading, shown in the panel header. */
  title: string;
  children: ReactNode;
  /** Optional class applied to the trigger button, for callers that need to match surrounding
   *  typography (defaults to the site's small accent-link treatment). */
  triggerClassName?: string;
}

/**
 * In-page modal sheet (V3b addendum commit 1) — for rich asides too big for `InlineExpander`'s
 * inline disclosure. Full-height sheet on mobile, centered glass panel on desktop; focus-trapped,
 * Escape closes + returns focus to the trigger, body scroll locked while open, motion-off renders
 * with no transition (instant show/hide) per the addendum's kill-switch rule.
 *
 * Deliberately NOT built on `<dialog>` — Cloudflare's target browser matrix for this project
 * (see e2e config) still includes engines with inconsistent `::backdrop` + focus-return support,
 * and the site already has a hand-rolled dialog pattern (AccessibilityPanel) this mirrors for
 * consistency: `role="dialog" aria-modal="true"`, manual focus trap, manual scroll lock.
 *
 * V5a fix 7 — the overlay is portaled to `document.body` (`createPortal`) rather than rendered
 * inline where the trigger button lives. Root cause of the reported bug ("clicking More on the
 * Problem/Approach/Architecture/Results cards renders overlapping panels inline, all four stacked
 * mid-grid, unreadable"): `position: fixed` computes its containing block from the nearest
 * ancestor that establishes one — and a `backdrop-filter` (used by this site's `.glass` class,
 * which `ProjectDeepDiveCards.astro` applies to each card wrapping a DetailSheet instance) is one
 * of the properties that does that, per spec, exactly like `transform`/`filter`/`perspective`.
 * With a `.glass` card as an ancestor, `inset: 0` resolved against THAT CARD's box instead of the
 * viewport — so each of the 4 simultaneously-renderable sheets appeared trapped inside its own
 * small card rather than centered over the page, reading as "overlapping panels stacked mid-grid"
 * once more than one was interacted with. Portaling to `document.body` — a guaranteed sibling of
 * every possible ancestor, never itself inside a transformed/filtered/contained box — makes this
 * work from ANY DOM context the trigger button happens to live in, not just this one call site.
 */
export default function DetailSheet({ triggerLabel, title, children, triggerClassName }: DetailSheetProps) {
  const [open, setOpen] = useState(false);
  // Tracks whether the sheet has been opened at least once this mount. Without this guard,
  // the close-effect fires on mount (open=false, initial render) and focuses the trigger button
  // before any user interaction — producing a spurious focus ring on page load (item 3,
  // 2026-07-06 refinement: "blue box roaming focus").
  const wasOpened = useRef(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hydration signal — lets E2E tests wait for this island before interacting.
  useHydrationSignal(triggerRef);

  // Body scroll lock while open (shared with CommandPalette — src/lib/scroll-lock.ts).
  useScrollLock(open);

  // Focus the panel on open; Escape closes and returns focus to the trigger; Tab is trapped
  // within the panel's focusable elements.
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    panel?.focus();

    function getFocusable(): HTMLElement[] {
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Return focus to the trigger once the sheet closes — but only if it was actually opened first.
  // A plain `if (!open)` guard would fire on mount (open=false), focusing the trigger immediately
  // and producing a focus ring on page load before the user has touched anything.
  useEffect(() => {
    if (open) {
      wasOpened.current = true;
    } else if (wasOpened.current) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const instant = !motionEnabled();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-island="detail-sheet"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline-offset-2 hover:underline'
        }
      >
        {triggerLabel}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="detail-sheet-overlay" data-instant={instant || undefined} onClick={() => setOpen(false)}>
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="detail-sheet-panel overlay-surface glass"
              data-instant={instant || undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border-glass)] p-5">
                <h2 id={titleId} className="font-display text-lg font-semibold text-[var(--text)]">
                  {title}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center text-muted hover:text-[var(--text)]"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="detail-sheet-body p-5 text-sm text-muted">{children}</div>
            </div>
          </div>,
          document.body
        )}

      <style>{`
        .detail-sheet-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgb(0 0 0 / 50%);
          animation: detail-sheet-fade var(--duration-micro, 200ms) var(--ease-out, ease-out);
        }

        .detail-sheet-overlay[data-instant] {
          animation: none;
        }

        .detail-sheet-panel {
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          animation: detail-sheet-slide-up var(--duration-reveal, 400ms) var(--ease-out, ease-out);
        }

        .detail-sheet-panel[data-instant] {
          animation: none;
        }

        @media (min-width: 640px) {
          .detail-sheet-overlay {
            align-items: center;
            padding: 1.5rem;
          }

          .detail-sheet-panel {
            width: min(100%, 640px);
            max-height: 80vh;
            border-radius: var(--radius-lg);
            animation: detail-sheet-pop var(--duration-micro, 200ms) var(--ease-out, ease-out);
          }
        }

        .detail-sheet-body :global(p + p) {
          margin-top: 0.75rem;
        }

        @keyframes detail-sheet-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes detail-sheet-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @keyframes detail-sheet-pop {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .detail-sheet-overlay,
          .detail-sheet-panel {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
