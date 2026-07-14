import { useEffect, useRef, useState } from 'react';
import { motionEnabled } from '../../lib/motion';

export interface NumberTickerProps {
  /** The metric text as authored, e.g. "$80M+", "120+", "~60% cost cut". */
  value: string;
}

/**
 * Parses a metric string into prefix/number/suffix so it can count up, but
 * only when the string contains exactly one numeric run (e.g. "$80M+",
 * "120+", "~60% cost cut"). Metrics with more than one number (e.g.
 * "2 -> 30+", "9 direct, 20+ coordinated") are ambiguous to animate and are
 * rendered as static text instead of silently dropping a number.
 */
function parseMetric(value: string): { prefix: string; number: number; suffix: string } | null {
  const numberRuns = value.match(/\d+(?:\.\d+)?/g);
  if (!numberRuns || numberRuns.length !== 1) return null;

  const match = value.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const [, prefix, numberStr, suffix] = match;
  return { prefix, number: parseFloat(numberStr), suffix };
}

/** Count-up number ticker for Journey impact metrics. Honors prefers-reduced-motion. */
export default function NumberTicker({ value }: NumberTickerProps) {
  const parsed = parseMetric(value);
  const [display, setDisplay] = useState(parsed ? 0 : null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!parsed) return;

    if (!motionEnabled()) {
      setDisplay(parsed.number);
      return;
    }

    const duration = 1200;
    const start = performance.now();
    let frame: number;
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      setDisplay(parsed!.number);
    }

    function tick(now: number) {
      // Progress is driven off elapsed wall-clock time, not frame count, so a throttled/backgrounded
      // tab (where rAF fires rarely or not at all) still lands on the correct value whenever the
      // next frame does run — but if the tab is hidden, don't wait for that: snap immediately below.
      const progress = Math.min(1, (now - start) / duration);
      if (progress >= 1) {
        finish();
        return;
      }
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(parsed!.number * eased);
      frame = requestAnimationFrame(tick);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') finish();
    }

    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!parsed || display === null) {
    return <span ref={ref}>{value}</span>;
  }

  const isInteger = Number.isInteger(parsed.number);
  const formatted = isInteger ? Math.round(display).toString() : display.toFixed(1);

  return (
    <span ref={ref}>
      {parsed.prefix}
      {formatted}
      {parsed.suffix}
    </span>
  );
}
