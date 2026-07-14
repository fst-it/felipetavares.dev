/**
 * Card magnetics + cursor spotlight (addendum V2b): a shared utility for project/writing/bento
 * cards marked `data-card-motion`. Magnetic hover uses `gsap.quickTo` to translate the card
 * toward the pointer, capped at 6px (spec: "translate <=6px"). The spotlight is a cursor-
 * following radial highlight driven by two CSS custom properties (`--spotlight-x`/`-y`) that the
 * card's own CSS (see effects.css `.card-spotlight`) turns into a radial-gradient overlay.
 *
 * `pointer:fine` only (spec) — coarse/touch pointers and motion-off get neither effect, so this
 * module is a no-op there (cards keep their existing plain hover styles from `.glass`/`hover:`
 * utility classes).
 */
import gsap from 'gsap';
import { motionEnabled, subscribeMotion } from './motion';

const MAX_TRANSLATE_PX = 6;

function hasFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

type Teardown = () => void;

function wireCard(card: HTMLElement): Teardown {
  const quickX = gsap.quickTo(card, 'x', { duration: 0.3, ease: 'power2.out' });
  const quickY = gsap.quickTo(card, 'y', { duration: 0.3, ease: 'power2.out' });

  function handlePointerMove(e: PointerEvent) {
    const rect = card.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    // Magnetic translate: offset scaled from card center, clamped to +/-6px.
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = ((relX - centerX) / centerX) * MAX_TRANSLATE_PX;
    const dy = ((relY - centerY) / centerY) * MAX_TRANSLATE_PX;
    quickX(gsap.utils.clamp(-MAX_TRANSLATE_PX, MAX_TRANSLATE_PX, dx));
    quickY(gsap.utils.clamp(-MAX_TRANSLATE_PX, MAX_TRANSLATE_PX, dy));

    // Spotlight position as percentages, read by the CSS radial-gradient.
    card.style.setProperty('--spotlight-x', `${(relX / rect.width) * 100}%`);
    card.style.setProperty('--spotlight-y', `${(relY / rect.height) * 100}%`);
  }

  function handlePointerLeave() {
    quickX(0);
    quickY(0);
  }

  card.classList.add('card-spotlight');
  card.addEventListener('pointermove', handlePointerMove);
  card.addEventListener('pointerleave', handlePointerLeave);

  return () => {
    card.classList.remove('card-spotlight');
    card.removeEventListener('pointermove', handlePointerMove);
    card.removeEventListener('pointerleave', handlePointerLeave);
    gsap.set(card, { x: 0, y: 0, clearProps: 'x,y' });
  };
}

let teardowns: Teardown[] = [];

function wireAll(root: ParentNode) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-card-motion]'));
  teardowns = cards.map(wireCard);
}

function unwireAll() {
  teardowns.forEach((fn) => fn());
  teardowns = [];
}

/** Wires (or tears down) magnetics/spotlight on every `[data-card-motion]` element in `root`,
 * based on motion + pointer-fine, and keeps it in sync with later motion-preference toggles. */
export function initCardMotion(root: ParentNode = document): void {
  if (!hasFinePointer()) return;

  if (motionEnabled()) wireAll(root);
  subscribeMotion((enabled) => {
    if (enabled) wireAll(root);
    else unwireAll();
  });
}
