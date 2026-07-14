/**
 * Generic segmented control (V5b C2) — extracted from the FxSegmentedControl
 * in AccessibilityPanel.tsx so it can be reused for any radiogroup-style
 * picker (FX tier, accent theme, etc.) with a single shared definition.
 *
 * Renders as `role="radiogroup"` with `role="radio"` buttons inside, matching
 * the accessibility pattern already established by FxSegmentedControl.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-1 rounded-full bg-[var(--surface-glass-strong)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-9 flex-1 rounded-full px-2 text-xs font-medium transition-colors duration-200 ${
            value === opt.value ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
