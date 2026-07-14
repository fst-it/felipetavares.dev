/**
 * Section-title reveals (addendum V2b): SplitText word-reveal (once, on first view, ~40ms
 * stagger) + a short thread underline draw-in, for any heading marked `data-reveal` (see
 * SectionHeading.astro and the hero-adjacent headings that opt in directly).
 *
 * FOUC-safe pattern per the brief: content is never hidden if this script fails to run. Markup
 * renders fully visible by default; only once this module confirms it's executing does it add a
 * class (`.reveal-armed`) and animate FROM that visible state via `gsap.set`, so the reveal is
 * additive polish, not a prerequisite for reading the heading.
 */
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEnabled } from './motion';

gsap.registerPlugin(SplitText, ScrollTrigger);

const STAGGER_S = 0.04; // ~40ms per spec

export function initSectionReveals(root: ParentNode = document): void {
  if (!motionEnabled()) return;

  const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal-armed])'));
  if (headings.length === 0) return;

  for (const heading of headings) {
    heading.setAttribute('data-reveal-armed', '');
    heading.classList.add('reveal-armed');

    const split = new SplitText(heading, { type: 'words', wordsClass: 'reveal-word' });

    // FOUC-safe: only set the animated FROM-state once the script is confirmed running (this
    // line), never in CSS/markup — so a failed script load leaves the heading fully visible.
    gsap.set(split.words, { opacity: 0, y: '0.6em' });

    // Thread underline: an inline SVG line appended after the heading text, drawn in alongside
    // the words. Uses the same stroke language as ScrollProgressThread (--accent + glow).
    const underline = document.createElement('span');
    underline.className = 'reveal-underline';
    underline.setAttribute('aria-hidden', 'true');
    heading.appendChild(underline);

    ScrollTrigger.create({
      trigger: heading,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        const tl = gsap.timeline();
        tl.to(split.words, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          stagger: STAGGER_S,
        });
        tl.fromTo(underline, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'left center' }, '-=0.2');
      },
    });
  }
}
