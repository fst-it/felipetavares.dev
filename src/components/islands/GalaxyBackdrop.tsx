import { useState, useEffect, useRef } from 'react';
import { motionEnabled, subscribeMotion } from '../../lib/motion';
import { readFxPreference, subscribeFxPreference } from '../../lib/hero-tier';
import Galaxy from './Galaxy';

function computeActive(): boolean {
  return motionEnabled() && readFxPreference() !== 'off';
}

function isLightTheme(): boolean {
  return document.documentElement.classList.contains('theme-light');
}

function isMobile(): boolean {
  return window.matchMedia('(max-width: 767px)').matches;
}

/**
 * GalaxyBackdrop — site-wide WebGL galaxy layer (React Bits Galaxy.tsx, MIT).
 *
 * Lifecycle rules (mirrors BrainCanvas pattern):
 *   - Renders when motion is on AND fx ≠ 'off'.
 *   - Returns null when motion is off or fx='off'; Starfield.astro shows through.
 *   - Re-renders on motion or fx preference changes via subscribeMotion /
 *     subscribeFxPreference.
 *   - Re-renders on theme change (light/dark) to swap star visibility props.
 *
 * Layout: position:fixed, inset:0, z-index:-1, pointer-events:none.
 * This sits above Starfield.astro (z-index:-1 shared layer, DOM order wins)
 * and below all page content.
 *
 * Desktop props (≥768px):
 *   hueShift:220, saturation:0.2, glowIntensity:0.22, density:1, starSpeed:0.4,
 *   speed:0.6, rotationSpeed:0.05, twinkleIntensity:0.3, mouseRepulsion:true,
 *   repulsionStrength:1.2, transparent:true
 *
 * Mobile overrides (<768px):
 *   density:0.6, mouseInteraction:false, mouseRepulsion:false,
 *   twinkleIntensity:0.2, speed:0.5
 *
 * Light theme: near-minimum glow + small stars — glowIntensity:0.05, saturation:0.05,
 * density:5.0 — so stars read as fine ink specks on ivory; content utterly dominant.
 * density is the star-size lever: higher density → larger GLSL `scale` → smaller cell
 * footprint in pixels. At 5.0 the near-visible layer (~depth 0.9) is ≈20px radius.
 */
export default function GalaxyBackdrop() {
  const [active, setActive] = useState(false); // SSR-safe: starts false, set on mount
  const [light, setLight] = useState(false);
  const [mobile, setMobile] = useState(false);
  const themeObserverRef = useRef<MutationObserver | null>(null);

  // Hydrate active state on mount and subscribe to changes
  useEffect(() => {
    setActive(computeActive());
    setLight(isLightTheme());
    setMobile(isMobile());

    function refresh() {
      setActive(computeActive());
    }

    const unsubMotion = subscribeMotion(() => refresh());
    const unsubFx = subscribeFxPreference(() => refresh());

    // Observe theme class changes on <html>
    const observer = new MutationObserver(() => {
      setLight(isLightTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    themeObserverRef.current = observer;

    // Observe mobile breakpoint changes
    const mq = window.matchMedia('(max-width: 767px)');
    const onBreakpoint = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onBreakpoint);

    return () => {
      unsubMotion();
      unsubFx();
      observer.disconnect();
      mq.removeEventListener('change', onBreakpoint);
    };
  }, []);

  if (!active) return null;

  const mobileProps = mobile
    ? {
        density: 0.6,
        mouseInteraction: false,
        mouseRepulsion: false,
        twinkleIntensity: 0.2,
        speed: 0.5,
      }
    : {};

  const lightProps = light
    ? {
        // Light theme: near-minimum glow + high density so stars are tiny specks.
        // density is the key star-size lever: the GLSL scale uniform is proportional
        // to density, so raising it shrinks each star's pixel footprint. At 5.0 the
        // peak-visible layer (depth≈0.9) has ≈20px radius; combined with glowIntensity
        // close to zero and near-zero saturation the result is barely-there ink dots.
        glowIntensity: 0.05,
        saturation: 0.05,
        density: 5.0,
      }
    : {};

  return (
    <div
      aria-hidden="true"
      data-galaxy-canvas
      {...(mobile ? { 'data-galaxy-mobile': '' } : {})}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100vw',
        height: '100vh',
      }}
    >
      <Galaxy
        hueShift={220}
        saturation={0.2}
        glowIntensity={0.22}
        density={1}
        starSpeed={0.4}
        speed={0.6}
        rotationSpeed={0.05}
        twinkleIntensity={0.3}
        mouseRepulsion={true}
        repulsionStrength={1.2}
        transparent={true}
        {...mobileProps}
        {...lightProps}
      />
    </div>
  );
}
