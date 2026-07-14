import { useEffect, useId, useRef, useState } from 'react';
import { PersonStanding, X } from 'lucide-react';
import { motionEnabled, setMotionOverride } from '../../lib/motion';
import { readFxPreference, setFxPreference, type FxPreference } from '../../lib/hero-tier';
import { SegmentedControl } from './SegmentedControl';
import type { Strings } from '../../i18n';
import { useHydrationSignal } from '../../lib/use-hydration-signal';

const CONTRAST_KEY = 'contrast';
const TEXT_KEY = 'text';
const CONTRAST_ATTR = 'data-contrast';
const TEXT_ATTR = 'data-text';
const ACCENT_KEY = 'accent';
const ACCENT_ATTR = 'data-accent';

type AccentMode = 'blue' | 'orange' | 'gradient';

function readContrast(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(CONTRAST_ATTR) === 'high';
}

function readLargeText(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(TEXT_ATTR) === 'large';
}

function setContrast(enabled: boolean): void {
  document.documentElement.setAttribute(CONTRAST_ATTR, enabled ? 'high' : 'normal');
  try {
    localStorage.setItem(CONTRAST_KEY, enabled ? 'high' : 'normal');
  } catch {
    // localStorage unavailable (private browsing, etc.) — override just won't persist.
  }
}

function setLargeText(enabled: boolean): void {
  document.documentElement.setAttribute(TEXT_ATTR, enabled ? 'large' : 'normal');
  try {
    localStorage.setItem(TEXT_KEY, enabled ? 'large' : 'normal');
  } catch {
    // localStorage unavailable (private browsing, etc.) — override just won't persist.
  }
}

function readAccent(): AccentMode {
  if (typeof document === 'undefined') return 'blue';
  const val = document.documentElement.getAttribute(ACCENT_ATTR);
  return val === 'orange' || val === 'gradient' ? val : 'blue';
}

function setAccent(mode: AccentMode): void {
  document.documentElement.setAttribute(ACCENT_ATTR, mode);
  try {
    localStorage.setItem(ACCENT_KEY, mode);
  } catch {
    // localStorage unavailable — override just won't persist.
  }
}

interface SwitchRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function SwitchRow({ label, description, checked, onChange }: SwitchRowProps) {
  return (
    // items-start, not items-center (root cause of the reported misalignment bug): the
    // description copy varies in length ("Stops all animation, scroll effects, and moving
    // decoration." wraps to 2 lines at the panel's fixed 360px width, "Increases the base text
    // size site-wide." fits on 1), so each row's text block is a different height. Centering the
    // switch within that variable-height block put it at a different Y offset per row — most
    // visible once a row's switch is ON (the accent color draws the eye to the offset). Top-
    // aligning the switch to the label's first line, with a small top margin to compensate for
    // the switch track's own height vs. the label's line-height, keeps it at a consistent Y
    // regardless of how the description wraps.
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-glass-strong)]'
        }`}
      >
        {/* Knob uses rem-based left positioning (not fixed-px translate) so it scales with
            html[data-text="large"]'s 118.75% root font-size and never overflows the track. */}
        <span
          aria-hidden="true"
          className="absolute top-1 h-5 w-5 rounded-full bg-[var(--accent-contrast)]"
          style={{
            left: checked ? 'calc(100% - 1.25rem - 0.25rem)' : '0.25rem',
            transition: 'left 200ms var(--ease-out, ease-out)',
          }}
        />
      </button>
    </div>
  );
}

/** "Visual effects: Auto / Full / Simple / Off" picker — wraps the shared SegmentedControl
 *  (V5b C2: extracted from inline radiogroup to single shared definition). Persists via
 *  `localStorage.fx` (src/lib/hero-tier.ts); motion-off still outranks this at `resolveTier()`. */
function FxSegmentedControl({ value, onChange, strings }: { value: FxPreference; onChange: (next: FxPreference) => void; strings: Strings['a11yPanel'] }) {
  const FX_OPTIONS: { value: FxPreference; label: string }[] = [
    { value: 'auto',   label: strings.visualEffectsAuto },
    { value: 'full',   label: strings.visualEffectsFull },
    { value: 'simple', label: strings.visualEffectsSimple },
    { value: 'off',    label: strings.visualEffectsOff },
  ];
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-[var(--text)]">{strings.visualEffectsLabel}</p>
      <p className="mt-0.5 text-xs text-muted">{strings.visualEffectsDescription}</p>
      <SegmentedControl label={strings.visualEffectsLabel} options={FX_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}

/** "Accent color: Blue / Orange / Gradient" picker (V5b C2). Persists via localStorage.accent
 *  and html[data-accent]; bridge + BrandMark always use orange–blue gradient regardless. */
function AccentSegmentedControl({ value, onChange, strings }: { value: AccentMode; onChange: (next: AccentMode) => void; strings: Strings['a11yPanel'] }) {
  const ACCENT_OPTIONS: { value: AccentMode; label: string }[] = [
    { value: 'blue',     label: strings.accentBlue },
    { value: 'orange',   label: strings.accentOrange },
    { value: 'gradient', label: strings.accentGradient },
  ];
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-[var(--text)]">{strings.accentLabel}</p>
      <p className="mt-0.5 text-xs text-muted">{strings.accentDescription}</p>
      <SegmentedControl label={strings.accentLabel} options={ACCENT_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}

/**
 * Accessibility control-center island (addendum V2c/section 7): a floating badge, fixed
 * bottom-left (mirroring the chat launcher's bottom-right placement — same safe-area-inset +
 * z-index approach, see .chat-safe-* in global.css and the launcher fix at a5c82ad), opening a
 * glass panel with three toggles:
 *
 * - Reduce motion: reads/writes the EXISTING `motion` localStorage key + `html[data-motion]`
 *   attr via src/lib/motion.ts — the single kill-switch every motion layer already subscribes to
 *   (Lenis, HeroBlueprint, aurora, section reveals, card magnetics, CSS animations). No second
 *   mechanism invented here.
 * - High contrast: new `html[data-contrast="high"]` + localStorage, resolved before first paint
 *   by BaseLayout's no-flash script (same pattern as theme/motion).
 * - Larger text: new `html[data-text="large"]` + localStorage, same no-flash resolution.
 *
 * Lazy-loaded (`client:idle` from BaseLayout, alongside ChatWidget) since it's not needed for
 * first paint. Keyboard accessible: Escape closes the panel and returns focus to the badge;
 * toggles are real `<button role="switch">` with `aria-checked`.
 */
export interface AccessibilityPanelProps {
  /** a11yPanel-slice of the locale dictionary (V3d addendum), passed from BaseLayout.astro. */
  strings: Strings['a11yPanel'];
  /** Root-relative path to the /accessibility page in the current locale — "/pt/accessibility"
   *  under the PT routes, "/accessibility" at the EN root. */
  accessibilityHref: string;
}

export default function AccessibilityPanel({ strings, accessibilityHref }: AccessibilityPanelProps) {
  const [open, setOpen] = useState(false);
  const [motionOn, setMotionOn] = useState(() => motionEnabled());
  const [highContrast, setHighContrast] = useState(readContrast);
  const [largeText, setLargeTextState] = useState(readLargeText);
  const [fxPreference, setFxPreferenceState] = useState<FxPreference>(readFxPreference);
  const [accentMode, setAccentModeState] = useState<AccentMode>(readAccent);
  const panelId = useId();
  const badgeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hydration signal — lets E2E tests wait for this island before interacting.
  useHydrationSignal(badgeRef);

  useEffect(() => {
    setMotionOn(motionEnabled());
    setHighContrast(readContrast());
    setLargeTextState(readLargeText());
    setFxPreferenceState(readFxPreference());
    setAccentModeState(readAccent());

    const staticBadge = document.getElementById('a11y-badge-static');
    if (staticBadge) staticBadge.style.display = 'none';
  }, []);

  // Lets other components open this panel without a direct import (V3c: the command palette's
  // "Accessibility options" action dispatches this — mirrors the existing "fst:open-chat" pattern).
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener('fst:open-a11y', handleOpen);
    return () => window.removeEventListener('fst:open-a11y', handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        badgeRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const firstToggle = panelRef.current?.querySelector<HTMLButtonElement>('[role="switch"]');
      firstToggle?.focus();
    }
  }, [open]);

  function toggleMotion(next: boolean) {
    setMotionOverride(next ? 'on' : 'off');
    setMotionOn(next);
  }

  function toggleContrast(next: boolean) {
    setContrast(next);
    setHighContrast(next);
  }

  function toggleLargeText(next: boolean) {
    setLargeText(next);
    setLargeTextState(next);
  }

  function changeFxPreference(next: FxPreference) {
    setFxPreference(next);
    setFxPreferenceState(next);
  }

  function changeAccentMode(next: AccentMode) {
    setAccent(next);
    setAccentModeState(next);
  }

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        data-island="a11y-panel"
        aria-label={open ? strings.badgeLabelClose : strings.badgeLabelOpen}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="border-beam overlay-surface glass btn-interactive btn-interactive--icon chat-safe-bottom chat-safe-left fixed z-40 flex h-14 w-14 min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--accent)] shadow-lg print:hidden"
      >
        {open ? <X size={22} aria-hidden="true" /> : <PersonStanding size={22} aria-hidden="true" />}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={strings.badgeLabelOpen}
          className="overlay-surface glass chat-safe-bottom chat-safe-left fixed z-40 mb-16 flex w-[min(90vw,360px)] flex-col overflow-y-auto rounded-[var(--radius-lg)] p-5"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)',
            // Clamp height so the panel never extends above the viewport top, even with
            // html[data-text="large"] scaling all rem-based content. overflow-y-auto lets
            // the user scroll within the panel when controls overflow.
            maxHeight: 'calc(100dvh - env(safe-area-inset-bottom, 0px) - 5.5rem - 1rem)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-semibold text-[var(--text)]">{strings.title}</p>
              <p className="mt-0.5 text-xs text-muted">{strings.description}</p>
            </div>
            <button
              type="button"
              aria-label={strings.badgeLabelClose}
              onClick={() => {
                setOpen(false);
                badgeRef.current?.focus();
              }}
              className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center text-muted hover:text-[var(--text)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2 divide-y divide-[var(--border-glass)]">
            <SwitchRow
              label={strings.reduceMotionLabel}
              description={strings.reduceMotionDescription}
              checked={!motionOn}
              onChange={(next) => toggleMotion(!next)}
            />
            <SwitchRow
              label={strings.highContrastLabel}
              description={strings.highContrastDescription}
              checked={highContrast}
              onChange={toggleContrast}
            />
            <SwitchRow
              label={strings.largerTextLabel}
              description={strings.largerTextDescription}
              checked={largeText}
              onChange={toggleLargeText}
            />
          </div>

          <div className="border-t border-[var(--border-glass)]">
            <FxSegmentedControl value={fxPreference} onChange={changeFxPreference} strings={strings} />
          </div>
          <div className="border-t border-[var(--border-glass)]">
            <AccentSegmentedControl value={accentMode} onChange={changeAccentMode} strings={strings} />
          </div>

          <a
            href={accessibilityHref}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {strings.readStatement}
          </a>
        </div>
      )}
    </>
  );
}
