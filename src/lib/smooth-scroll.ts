/**
 * Site-wide Lenis smooth scroll (addendum V2b, "Motion stack & choreography"). Lazy-loaded (only
 * imported from the inline bootstrap script below, never eagerly bundled into a page's main
 * chunk), disabled when the motion kill-switch is off, and left as native scrolling on touch
 * devices (Lenis's `syncTouch: false` default — spec: "on touch devices keep native scrolling").
 *
 * Integrates with GSAP's ScrollTrigger via the documented `lenis.on('scroll', ScrollTrigger.update)`
 * + `gsap.ticker` pattern so scroll-scrubbed animations (Journey path line, section reveals) stay
 * in sync with Lenis's virtual scroll position instead of the raw (unthrottled-by-Lenis) native one.
 */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEnabled, subscribeMotion } from './motion';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;

function hasCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

function start(): void {
  if (lenis || hasCoarsePointer()) return;

  lenis = new Lenis({
    autoRaf: false,
    // syncTouch left at its default (false) — native scrolling on touch devices, per spec.
  });

  lenis.on('scroll', ScrollTrigger.update);

  tickerFn = (time: number) => {
    lenis?.raf(time * 1000);
  };
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
}

function stop(): void {
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
  lenis?.destroy();
  lenis = null;
}

/** Boots (or tears down) Lenis based on the current motion preference, and keeps it in sync with
 * later toggles. Anchor links and keyboard scrolling are untouched — Lenis intercepts wheel/touch
 * input only, so `<a href="#...">` and PageUp/Down/Space/arrow-key native scrolling keep working. */
export function initSmoothScroll(): void {
  if (motionEnabled()) start();
  subscribeMotion((enabled) => {
    if (enabled) start();
    else stop();
  });
}

/**
 * Pauses (or resumes) Lenis's own wheel/touch handling — needed alongside the usual
 * `body.style.overflow = 'hidden'` scroll-lock (see src/lib/scroll-lock.ts) because Lenis drives
 * scroll itself via its own RAF loop and intercepts wheel input directly; it does not consult
 * `overflow` at all, so a modal/overlay open over a Lenis-scrolled page keeps scrolling the page
 * underneath regardless of `overflow: hidden` (V5a fix 6 — owner: command palette wheel scrolled
 * the page, not the palette's own list). No-op when Lenis isn't running (touch devices, reduced
 * motion) since there's nothing to pause in that case.
 */
export function pauseSmoothScroll(): void {
  lenis?.stop();
}

export function resumeSmoothScroll(): void {
  lenis?.start();
}
