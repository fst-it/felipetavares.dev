import { useEffect, type RefObject } from 'react';

/**
 * Sets `data-hydrated="true"` on the referenced element once the component mounts.
 *
 * Used by island components so E2E tests can wait for hydration before interacting,
 * avoiding timing races when many islands load in parallel. One utility, no framework.
 *
 * Usage: call once at the top of an island component, passing any ref that points at
 * a persistent root element (trigger button, wrapper div, etc.).
 *
 *   const rootRef = useRef<HTMLDivElement>(null);
 *   useHydrationSignal(rootRef);
 *   // Tests: await page.locator('[data-island="x"][data-hydrated="true"]').waitFor()
 */
export function useHydrationSignal<T extends HTMLElement>(ref: RefObject<T | null>): void {
  useEffect(() => {
    ref.current?.setAttribute('data-hydrated', 'true');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
