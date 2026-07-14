/**
 * Experience view toggle (item 11, 2026-07-06 refinement): segmented "Summary | Detailed"
 * control at the top of /experience and /pt/experience.
 *
 * Both view variants (Summary and Detailed) are SSR'd into the HTML — the toggle drives CSS
 * visibility via a `data-experience-view` attribute on the section container. No hydration
 * jank: the initial view is set by reading sessionStorage + the `?view=` query param before
 * the component mounts, then applied via the attribute; the SSR HTML defaults to "detailed"
 * (the full chapter view) so the page is always meaningful without JS.
 *
 * View is persisted in sessionStorage (not localStorage, since it's page-session-scoped)
 * and deep-linkable via `?view=summary` or `?view=detailed`.
 */
import { useEffect, useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

export type ExperienceView = 'summary' | 'detailed';

export interface ExperienceViewToggleProps {
  /** Localised label for the control (aria-label). */
  label: string;
  summaryLabel: string;
  detailedLabel: string;
  /** `data-experience-view` is set on the element with this id. */
  sectionId: string;
}

const SESSION_KEY = 'fst:experience-view';

function resolveInitialView(): ExperienceView {
  if (typeof window === 'undefined') return 'summary';
  const param = new URLSearchParams(window.location.search).get('view');
  if (param === 'summary' || param === 'detailed') return param;
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored === 'summary' || stored === 'detailed') return stored;
  return 'summary';
}

export default function ExperienceViewToggle({
  label,
  summaryLabel,
  detailedLabel,
  sectionId,
}: ExperienceViewToggleProps) {
  const [view, setView] = useState<ExperienceView>('summary');

  // Sync the data-attr on mount (SSR renders 'detailed' by default; we apply the persisted or
  // URL-specified view once JS runs — runs before first paint on `client:load`).
  useEffect(() => {
    const initial = resolveInitialView();
    setView(initial);
    applyView(initial, sectionId);
  }, [sectionId]);

  function handleChange(next: ExperienceView) {
    setView(next);
    applyView(next, sectionId);
    try {
      sessionStorage.setItem(SESSION_KEY, next);
    } catch {
      // sessionStorage unavailable — view change still applies in-memory for this render.
    }
    // Update the URL query param without a full navigation.
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.replaceState(null, '', url.toString());
  }

  return (
    <div className="flex justify-center">
      <SegmentedControl
        label={label}
        options={[
          { value: 'summary', label: summaryLabel },
          { value: 'detailed', label: detailedLabel },
        ]}
        value={view}
        onChange={handleChange}
      />
    </div>
  );
}

function applyView(view: ExperienceView, sectionId: string) {
  const section = document.getElementById(sectionId);
  if (section) section.setAttribute('data-experience-view', view);
}
