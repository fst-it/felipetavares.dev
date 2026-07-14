import { useState, useEffect, useRef } from 'react';
import { motionEnabled, subscribeMotion } from '../../lib/motion';
import { readFxPreference, subscribeFxPreference } from '../../lib/hero-tier';
import type { FxPreference } from '../../lib/hero-tier';
import type { BrainInstance, BrainConfig } from '../../lib/brain/brain-engine.js';
import { BRAIN_CONFIG_1B } from '../../lib/brain/brain-config-1b.js';
// brain-engine.js is imported dynamically inside useEffect (never server-side) to prevent
// the IIFE from executing in Node.js where window/this are undefined.

declare const createBrainMesh: (canvas: HTMLCanvasElement, cfg: BrainConfig) => BrainInstance;

// Light-theme engine palette (owner 2026-07-08): the 1b colors are glow tones tuned for a dark
// canvas; on the light hero surface they wash out, so nodes/edges/signals deepen instead.
// Engine stays untouched — this is config, the supported customization surface.
const LIGHT_COLOR_OVERRIDES = {
  edgeCol: [35, 110, 220] as [number, number, number],
  edgeA: 0.22,
  nodeCols: [
    [37, 111, 224], [37, 111, 224],
    [29, 78, 180],
    [194, 84, 10],
    [15, 118, 110],
  ] as Array<[number, number, number]>,
  sigCols: [
    [37, 111, 224], [37, 111, 224],
    [220, 90, 20], [13, 148, 110],
  ] as Array<[number, number, number]>,
};

function isLightTheme(): boolean {
  return document.documentElement.classList.contains('theme-light');
}

function computeActive(): boolean {
  return motionEnabled() && readFxPreference() !== 'off';
}

/**
 * BrainCanvas — React island that mounts/unmounts the 1b "Deep Signal" brain animation.
 *
 * Lifecycle rules:
 *   - Canvas element rendered and engine created when motion is on AND fx ≠ 'off'.
 *   - Canvas element removed (returns null) and engine destroyed when motion turns off or fx='off'.
 *   - Recreated on the reverse transitions via subscribeMotion / subscribeFxPreference.
 *   - Config updated live (via engine.set()) when fx changes between 'simple' and 'auto'/'full'
 *     while the engine is already running (no remount needed).
 *
 * AccessibilityPanel "Visual effects" wiring:
 *   Off     → canvas unmounted, engine destroyed.
 *   Simple  → createBrainMesh with intensity 4, glow 1.2.
 *   Auto/Full → BRAIN_CONFIG_1B defaults (intensity 7, glow 1.8).
 *
 * The canvas is sized via CSS only; the engine handles ResizeObserver + DPR itself.
 */
export default function BrainCanvas() {
  const [active, setActive] = useState(computeActive);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brainRef = useRef<BrainInstance | null>(null);
  const themeObserverRef = useRef<MutationObserver | null>(null);
  const lastLightRef = useRef<boolean>(false);

  // Subscribe to motion/fx changes. When active stays true and fx changes between
  // 'simple' and 'auto'/'full', update engine config live without a remount.
  useEffect(() => {
    function refresh() {
      const on = motionEnabled();
      const fx: FxPreference = readFxPreference();
      const next = on && fx !== 'off';
      if (!next) {
        brainRef.current?.destroy();
        brainRef.current = null;
      } else if (brainRef.current) {
        // Engine running — live-update config.
        if (fx === 'simple') {
          brainRef.current.set({ intensity: 4, glow: 1.2 });
        } else {
          brainRef.current.set({ intensity: BRAIN_CONFIG_1B.intensity, glow: BRAIN_CONFIG_1B.glow });
        }
      }
      setActive(next);
    }

    const unsubMotion = subscribeMotion(() => refresh());
    const unsubFx = subscribeFxPreference(() => refresh());

    return () => {
      unsubMotion();
      unsubFx();
    };
  }, []);

  // Start engine when canvas mounts (initial mount and after active: false→true transitions).
  // Dynamic import keeps the IIFE out of the SSR module graph — it only runs in the browser.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    import('../../lib/brain/brain-engine.js').then(() => {
      if (cancelled || !canvasRef.current || brainRef.current) return;
      const fx = readFxPreference();
      // Mobile (dimmed-background mode, owner decision 2026-07-08): the canvas sits behind the
      // text under a legibility scrim, so the engine runs calmer — lower intensity, labels off
      // (hover tooltips are pointless on touch; tap-burst still works).
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      const buildConfig = () => ({
        ...BRAIN_CONFIG_1B,
        ...(isLightTheme() ? LIGHT_COLOR_OVERRIDES : {}),
        ...(mobile ? { intensity: 4 as const, labels: false } : {}),
        ...(readFxPreference() === 'simple' ? { intensity: 4 as const, glow: 1.2 } : {}),
      });
      brainRef.current = createBrainMesh(canvasRef.current, buildConfig());
      // Colors are baked at creation, so a theme flip recreates the engine with the
      // matching palette (class change on <html> observed; engine itself untouched).
      lastLightRef.current = isLightTheme();
      const observer = new MutationObserver(() => {
        if (!canvasRef.current || !brainRef.current) return;
        const light = isLightTheme();
        if (light === lastLightRef.current) return; // class changed, theme didn't
        lastLightRef.current = light;
        brainRef.current.destroy();
        brainRef.current = createBrainMesh(canvasRef.current, buildConfig());
        canvasRef.current.setAttribute('data-brain-state', 'running');
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      themeObserverRef.current = observer;
      // Signal that the engine is running — tests wait for this before toggling motion.
      // Guarantees the subscription useEffect has run (effects are ordered; subscription
      // effect runs before this engine effect, so subscriber is registered by now).
      canvasRef.current.setAttribute('data-brain-state', 'running');
    }).catch(() => {
      // engine import or startup failed — canvas stays in DOM but engine won't run.
    });

    return () => {
      cancelled = true;
      themeObserverRef.current?.disconnect();
      themeObserverRef.current = null;
      brainRef.current?.destroy();
      brainRef.current = null;
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-brain-canvas
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
