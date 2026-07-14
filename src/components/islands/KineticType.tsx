import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import gsap from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';
import { motionEnabled, subscribeMotion } from '../../lib/motion';

gsap.registerPlugin(TextPlugin);

export interface KineticPair {
  verb: string;
  noun: string;
}

export interface KineticTypeProps {
  /**
   * Curated verb/noun pairs (V3 addendum: kinetic type curated pairing; V3-polish commit 4) — a
   * flat allow-list of grammatically sound combinations rather than a verb x noun cross-product
   * (which produced awkward pairs like "lead AI systems" in V2, and later "lead leadership teams"
   * — a verb sharing its stem with its own noun, which reads as nonsense no matter how it's typed
   * out). Order is the cycle order. Passed as a prop (V3d addendum) so the EN and PT-BR curated
   * lists can live in Hero.astro per locale, keeping this island a pure function of its props.
   *
   * RULE: a verb must never share a stem with its paired noun (e.g. "lead" + any noun containing
   * "lead*" is disallowed — that's why 'lead' pairs only with 'global teams' / 'engineering
   * organizations' below, not a "leadership ..." noun). The same rule applies to the PT-BR set
   * (e.g. "lidero" must never pair with a "liderança ..." noun).
   */
  pairs: KineticPair[];
  /**
   * Locale pronoun rendered before the verb ("I" / "Eu"). Moved from Hero.astro into the island
   * (ledger row 101) so the entire phrase — pronoun + verb + noun — lives in one inline text flow
   * rather than being split across a flex container, which caused the pronoun to orphan on its own
   * centered row when the full phrase wrapped on narrow viewports.
   */
  pronoun?: string;
}

// 4-color accent cycle (addendum section 3) — one class per pair index, cycling. The verb is the
// louder element (V3: larger/bolder/color-cycling/underline draw-in); the noun keeps the typed
// treatment in the muted/text color.
const ACCENT_VARS = ['--accent', '--accent-violet', '--accent-cyan', '--accent-orange'] as const;
const ACCENT_CLASSES = [
  'text-[var(--accent)]',
  'text-[var(--accent-violet)]',
  'text-[var(--accent-cyan)]',
  'text-[var(--accent-orange)]',
];

const TYPE_SPEED_MS = 55;
const HOLD_MS = 1400;
const DELETE_SPEED_MS = 30;

/**
 * "I " + verb + " " + noun, both slots rotating through curated pairs (V3 addendum: kinetic type).
 * The verb is the louder element — larger, bolder, color-cycling, with an underline draw-in; the
 * noun keeps the existing GSAP TextPlugin typed treatment. Under prefers-reduced-motion, renders
 * the static first pair with zero animation. The leading "I "/"Eu " pronoun is rendered by the
 * caller (Hero.astro) since it's locale copy, not part of this island's own markup.
 *
 * Kinetic color shift (santifer-style, this commit): while the verb is typing, its color
 * interpolates per character from the current accent token toward --brand-warm via a
 * background-clip:text gradient whose stop position tracks the typed character progress (0→1).
 * The gradient is `linear-gradient(90deg, accent 0%, accent <p>%, brand-warm <p>%, brand-warm 100%)`
 * where <p> is the typed-fraction * 100. At p=0 the whole word reads as the accent; at p=1 the
 * whole word reads as brand-warm. On hold and delete, the gradient collapses back to accent-only.
 * Motion-gated: under reduced-motion/motion-off the verb renders in the static accent class (no
 * gradient, same as before). Both EN and PT-BR locales inherit this automatically since locale
 * affects only the pair content, not the animation logic.
 */
export default function KineticType({ pairs, pronoun }: KineticTypeProps) {
  const PAIRS = pairs;
  const STATIC_PAIR = PAIRS[0];
  const verbRef = useRef<HTMLSpanElement>(null);
  const nounRef = useRef<HTMLSpanElement>(null);
  const underlineRef = useRef<HTMLSpanElement>(null);
  // Lazy initializer reads the kill-switch synchronously on the client's first render (rather
  // than defaulting to false and flipping after an effect), so reduced-motion users never see a
  // flash of empty text before settling on the static final pair.
  const [reducedMotion, setReducedMotion] = useState(() => !motionEnabled());
  const [pairIndex, setPairIndex] = useState(0);
  const [ready, setReady] = useState(false);
  // charProgress: 0 = full accent, 1 = full brand-warm. Only meaningful while typing (motion on).
  const [charProgress, setCharProgress] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setReducedMotion(!motionEnabled());
    setReady(true);
    return subscribeMotion((enabled) => setReducedMotion(!enabled));
  }, []);

  useEffect(() => {
    if (!ready || reducedMotion) return;
    const verbEl = verbRef.current;
    const nounEl = nounRef.current;
    const underlineEl = underlineRef.current;
    if (!verbEl || !nounEl) return;

    let cancelled = false;
    const tl = gsap.timeline({ repeat: -1 });

    PAIRS.forEach(({ verb, noun }, i) => {
      tl.call(() => {
        if (!cancelled) { setPairIndex(i); setCharProgress(0); setIsTyping(true); }
      });
      // Verb: typed in. onUpdate tracks char progress for the gradient color shift.
      tl.to(verbEl, {
        duration: (verb.length * TYPE_SPEED_MS) / 1000,
        text: verb,
        ease: 'none',
        onUpdate() {
          if (!cancelled) {
            const typed = verbEl.textContent?.length ?? 0;
            setCharProgress(verb.length > 0 ? typed / verb.length : 0);
          }
        },
      });
      tl.to(verbEl, { scale: 1.05, fontWeight: 800, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<');
      if (underlineEl) {
        tl.fromTo(underlineEl, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.out', transformOrigin: 'left' });
      }
      // Noun: typed in immediately after (existing typed treatment). Verb color holds at 1 during noun.
      tl.call(() => { if (!cancelled) setIsTyping(false); });
      tl.to(nounEl, { duration: (noun.length * TYPE_SPEED_MS) / 1000, text: noun, ease: 'none' });
      tl.to({}, { duration: HOLD_MS / 1000 });
      // Both slots delete together before the next pair. Reset gradient on delete start.
      tl.call(() => { if (!cancelled) { setCharProgress(0); setIsTyping(false); } });
      if (underlineEl) {
        tl.to(underlineEl, { scaleX: 0, duration: 0.2, ease: 'power1.in', transformOrigin: 'left' });
      }
      tl.to(nounEl, { duration: (noun.length * DELETE_SPEED_MS) / 1000, text: '', ease: 'none' }, '<');
      tl.to(verbEl, { duration: (verb.length * DELETE_SPEED_MS) / 1000, text: '', ease: 'none' });
    });

    return () => {
      cancelled = true;
      tl.kill();
    };
  }, [ready, reducedMotion]);

  const accentClass = reducedMotion
    ? ACCENT_CLASSES[0]
    : ACCENT_CLASSES[pairIndex % ACCENT_CLASSES.length];

  // Build the per-character gradient style for the verb span while typing.
  const accentVar = `var(${ACCENT_VARS[pairIndex % ACCENT_VARS.length]})`;
  // backgroundClip + WebkitBackgroundClip are applied via the `.kinetic-gradient-clip` CSS class
  // (toggled on the same element) rather than inline style: React 19 silently drops
  // WebkitBackgroundClip / backgroundClip from CSSProperties objects. backgroundImage,
  // WebkitTextFillColor, and color vary per frame so they stay in the inline style object.
  const gradientActive = !reducedMotion && (isTyping || charProgress > 0);
  const verbGradientStyle: CSSProperties = gradientActive
    ? {
        backgroundImage: `linear-gradient(90deg, ${accentVar} 0%, ${accentVar} ${(charProgress * 100).toFixed(1)}%, var(--brand-warm) ${(charProgress * 100).toFixed(1)}%, var(--brand-warm) 100%)`,
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      }
    : {};

  return (
    // Outer span is display:inline (default for <span>) so the entire phrase — pronoun + verb +
    // noun — flows as natural inline text inside the parent <p>. Wrapping then happens at word
    // boundaries, and text-align on the parent (text-center mobile / lg:text-left desktop) centers
    // or left-aligns every wrapped line consistently. Previously the outer span was inline-flex
    // flex-wrap, which made the pronoun (sibling flex item in Hero.astro) orphan onto a centered
    // row of its own when the phrase was too wide — ledger row 101.
    <span className="kinetic-type font-display">
      <span className="sr-only">
        {pronoun ? `${pronoun} ` : ''}{STATIC_PAIR.verb} {STATIC_PAIR.noun}.
      </span>
      {/* Single aria-hidden wrapper covers all visual content. */}
      <span aria-hidden="true">
        {pronoun && <><span>{pronoun}</span>{' '}</>}
        {/* kinetic-verb-wrap is display:inline-block so it participates in the inline text flow
            while providing a position:relative containing block for the absolutely-positioned
            underline. vertical-align:baseline keeps the verb's text baseline aligned with the
            pronoun and noun on the same line. Previously this was inline-flex flex-col, which
            made the verb an indivisible block item that fragmented from the noun on wrap. */}
        <span className="kinetic-verb-wrap">
          <span
            className={`kinetic-verb text-3xl font-bold sm:text-4xl ${accentClass}`}
          >
            <span
              ref={verbRef}
              style={verbGradientStyle}
              className={gradientActive ? 'kinetic-gradient-clip' : undefined}
            >{reducedMotion ? STATIC_PAIR.verb : ''}</span>
            {!reducedMotion && <span className="kinetic-caret" aria-hidden="true" />}
          </span>
          <span
            ref={underlineRef}
            className="kinetic-verb-underline"
            style={{ background: `var(${ACCENT_VARS[pairIndex % ACCENT_VARS.length]})` }}
          />
        </span>
        {' '}
        <span className="break-words text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          <span ref={nounRef}>{reducedMotion ? STATIC_PAIR.noun : ''}</span>
        </span>
      </span>
    </span>
  );
}
