import { useEffect } from 'react';
import { pauseSmoothScroll, resumeSmoothScroll } from './smooth-scroll';

/**
 * Shared body-scroll-lock hook (V5a fix 6 — composability mandate: DetailSheet and
 * CommandPalette each hand-rolled the identical `document.body.style.overflow = 'hidden'` effect
 * independently; extracted here as the single definition both now call).
 *
 * Locks page scroll while `active` is true, restoring the body's previous inline `overflow` value
 * (not a hardcoded `''`) on cleanup so it composes correctly if some future caller nests two
 * lockable overlays. Also pauses Lenis (src/lib/smooth-scroll.ts) for the same duration — Lenis
 * drives scroll itself via its own RAF loop and doesn't consult `overflow` at all, so without this
 * a wheel over the locked overlay kept scrolling the page underneath (V5a fix 6).
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    pauseSmoothScroll();
    return () => {
      document.body.style.overflow = overflow;
      resumeSmoothScroll();
    };
  }, [active]);
}
