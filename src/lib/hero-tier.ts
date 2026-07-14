/**
 * Three-tier hero renderer selection (V3 addendum section "three-tier hero renderer").
 *
 * Tier 1 "still": fully-drawn static SVG. SSR baseline and fallback.
 * Tier 2 "mesh": animated SVG (default) — multi-pulse, multi-color traveling dots.
 * Tier 3 "neural": WebGL particle field layered under the Tier-2 SVG.
 *
 * Resolution order: motion-off always wins (outranks everything) -> explicit user override
 * (`localStorage.fx`) -> heuristic auto-detection. `resolveTier()` is pure given its inputs so it
 * can be unit-tested without a DOM; `resolveTierFromEnvironment()` reads the actual browser globals
 * for runtime use.
 */

export type HeroTier = 'still' | 'mesh' | 'neural';
export type FxPreference = 'auto' | 'full' | 'simple' | 'off';

const FX_STORAGE_KEY = 'fx';
const FX_VALUES: FxPreference[] = ['auto', 'full', 'simple', 'off'];

export interface TierEnvironment {
  motionOn: boolean;
  fxPreference: FxPreference;
  saveData: boolean;
  hardwareConcurrency: number;
  viewportWidth: number;
  pointerFine: boolean;
  webgl2Available: boolean;
}

/**
 * Pure decision function (V3 spec gates):
 * - motion off -> always Tier 1 (outranks the override).
 * - override 'off' -> Tier 1. Override 'simple' -> Tier 2. Override 'full' -> attempt Tier 3
 *   (still subject to the Save-Data / JS-failure realities, but NOT the viewport/hardware/pointer
 *   heuristics — "Full" is an explicit ask).
 * - override 'auto' (or unset) -> heuristics: Tier 3 requires viewport>=1024, pointer:fine,
 *   WebGL2, hardwareConcurrency>=8, no Save-Data; else Tier 2; Save-Data or
 *   hardwareConcurrency<=2 forces Tier 1.
 */
export function resolveTier(env: TierEnvironment): HeroTier {
  if (!env.motionOn) return 'still';
  if (env.fxPreference === 'off') return 'still';
  if (env.saveData || env.hardwareConcurrency <= 2) return 'still';

  if (env.fxPreference === 'simple') return 'mesh';

  if (env.fxPreference === 'full') {
    return env.webgl2Available ? 'neural' : 'mesh';
  }

  // 'auto' heuristics.
  const meetsNeuralGate =
    env.viewportWidth >= 1024 &&
    env.pointerFine &&
    env.webgl2Available &&
    env.hardwareConcurrency >= 8;

  return meetsNeuralGate ? 'neural' : 'mesh';
}

export function readFxPreference(): FxPreference {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const stored = localStorage.getItem(FX_STORAGE_KEY);
    return (FX_VALUES as string[]).includes(stored ?? '') ? (stored as FxPreference) : 'auto';
  } catch {
    return 'auto';
  }
}

export function setFxPreference(pref: FxPreference): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FX_STORAGE_KEY, pref);
  } catch {
    // localStorage unavailable (private browsing, etc.) — preference just won't persist.
  }
  for (const cb of subscribers) cb(pref);
}

const subscribers = new Set<(pref: FxPreference) => void>();

export function subscribeFxPreference(callback: (pref: FxPreference) => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

interface NavigatorConnection {
  saveData?: boolean;
}

function detectWebgl2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/** Reads the live browser environment. Not called during SSR — callers must gate with a client
 *  effect (Tier 1 is always the SSR-rendered baseline; see HeroBlueprint.tsx). */
export function resolveTierFromEnvironment(motionOn: boolean): HeroTier {
  const nav = navigator as Navigator & { connection?: NavigatorConnection };
  return resolveTier({
    motionOn,
    fxPreference: readFxPreference(),
    saveData: nav.connection?.saveData === true,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
    viewportWidth: window.innerWidth,
    pointerFine: window.matchMedia('(pointer: fine)').matches,
    webgl2Available: detectWebgl2(),
  });
}
