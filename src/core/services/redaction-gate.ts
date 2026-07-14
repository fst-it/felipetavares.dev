/**
 * Redaction gate scanner (V2 addendum section 6: "Metric redaction"). Automates what V2a's
 * gate did by hand (commit 237c83f) — scans text for employer-tied absolute financial figures
 * and company-tied headcounts that must never appear on the public site, with an allow-list for
 * the specific exceptions the addendum itself carves out.
 *
 * Pure logic lives here (no filesystem/process access) so it's unit-testable; scripts/redaction-gate.ts
 * is the thin CLI that walks the filesystem and calls `scanText`.
 *
 * Single-definition rule (docs/architecture.md §3): the pipeline-volume / company-name
 * category is authoritative in selfwright-metrics-curation.ts's DENY_LIST. This module imports
 * and re-uses that list rather than maintaining a parallel copy — so adding a new denied term to
 * DENY_LIST automatically extends the gate's coverage too.
 */
import { DENY_LIST } from './selfwright-metrics-curation';

export interface ForbiddenPattern {
  /** Short label used in violation reports. */
  name: string;
  regex: RegExp;
}

export interface Violation {
  file: string;
  pattern: string;
  match: string;
  /** 1-based line number within the file, for quick lookup. */
  line: number;
}

/**
 * Forbidden pattern list (addendum section 6):
 *  - "NEVER on public site: absolute financial figures tied to an employer ... AND company-tied
 *    team sizes/headcounts."
 * Two kinds of entries:
 *  1. A generic regex catching any `$`/`€`/`£` amount followed by digits and a magnitude suffix
 *     (M/K/B/MM), so a future redaction slip is caught even if it isn't one of the specific
 *     strings below.
 *  2. The exact strings redacted in the V2a history (commit 237c83f) — kept explicit so the gate
 *     documents precisely what was scrubbed and re-flags it if it ever creeps back in (e.g. via a
 *     careless content revert).
 */
export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    name: 'currency-magnitude (generic $/€/£ + digits + M/K/B)',
    regex: /[$€£]\s?\d[\d,.]*\s?(?:[MKB]|MM|Mn|Bn)\b/gi,
  },
  // Exact figures redacted during V2a (addendum section 6, commit 237c83f) — explicit so the
  // report can say precisely which historical figure resurfaced.
  { name: 'redacted figure: $80M', regex: /\$80M\b/g },
  { name: 'redacted figure: $55M', regex: /\$55M\b/g },
  { name: 'redacted figure: $15M', regex: /\$15M\b/g },
  { name: 'redacted figure: $5M', regex: /\$5M\b/g },
  { name: 'redacted figure: $8M', regex: /\$8M\b/g },
  { name: 'redacted figure: $18M', regex: /\$18M\b/g },
  { name: 'redacted figure: €1.25M', regex: /€1\.25M\b/g },
  { name: 'redacted figure: €800K', regex: /€800K\b/g },
  { name: 'redacted figure: €450K', regex: /€450K\b/g },
  { name: 'redacted figure: €2M', regex: /€2M\b/g },
  { name: 'redacted figure: ~$400M', regex: /~\$400M\b/g },
  // Company-tied headcount patterns (addendum section 6: "company-tied team sizes/headcounts").
  // The allowed exception is the anonymized executive-summary shape "≈10 direct, 20+ dotted-line"
  // (no employer attached) — see ALLOW_LIST below, not these patterns.
  { name: 'headcount: "9 direct"', regex: /\b9\s+direct\b/gi },
  { name: 'headcount: "120+ engineers"', regex: /\b120\+?\s+engineers\b/gi },
  // Pipeline-volume / company-name patterns from selfwright-metrics-curation.ts's DENY_LIST
  // (single-definition rule: imported above, converted here into scanText-compatible patterns).
  // The gate must catch these strings in ANY scanned file — content/, dist/, or scripts output —
  // not just inside selfwright metric imports. No allow-list entries are needed for these because
  // none of them appear as approved phrasing anywhere on the public site.
  ...DENY_LIST.map((term) => ({
    name: `selfwright-deny: "${term}"`,
    regex: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
  })),
];

/**
 * Allow-list: substrings that are permitted even though they might otherwise trip a forbidden
 * pattern (e.g. a currency-magnitude match embedded in permitted text, or article code snippets
 * that legitimately contain a dollar sign + number for unrelated reasons). Matched against the
 * exact matched substring OR a surrounding-context window, so the gate can allow the specific
 * approved phrase without blinding it to nearby unrelated violations.
 */
export const ALLOW_LIST: string[] = [
  // Addendum section 6: "Executive summary only ... approximate org shape with NO employer
  // attached" — the one permitted headcount phrasing.
  '≈10 direct, 20+ dotted-line',
  // Selfwright markdown twin (dist/projects/selfwright.md) and explanatory prose describe what
  // the gate *prevents* using the very terms it blocks. These allow-list entries permit the
  // negated form ("no pipeline volume", "no application count") so the gate doesn't false-positive
  // on its own documentation. The raw terms still trip the gate when they appear without negation.
  'no pipeline volume',
  'no application count',
];

function isAllowListed(matchedText: string, lineText: string): boolean {
  return ALLOW_LIST.some((allowed) => lineText.includes(allowed) && allowed.includes(matchedText.replace(/\\/g, '')));
}

/**
 * Scans a single file's text content for forbidden patterns, skipping any match that falls
 * within an allow-listed phrase on the same line.
 */
export function scanText(filePath: string, text: string): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split('\n');

  for (const pattern of FORBIDDEN_PATTERNS) {
    // Reset lastIndex per file since regexes are reused across calls (global flag is stateful).
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = re.exec(text)) !== null) {
      const upToMatch = text.slice(0, match.index);
      const line = upToMatch.split('\n').length;
      const lineText = lines[line - 1] ?? '';

      if (isAllowListed(match[0], lineText)) continue;

      violations.push({
        file: filePath,
        pattern: pattern.name,
        match: match[0],
        line,
      });

      if (match[0].length === 0) re.lastIndex++; // guard against zero-width infinite loop
    }
  }

  return violations;
}

/** Formats a human-readable report from a list of violations across files. */
export function formatReport(violations: Violation[]): string {
  if (violations.length === 0) return 'Redaction gate: no forbidden patterns found.';

  const lines = [`Redaction gate: ${violations.length} violation(s) found:\n`];
  for (const v of violations) {
    lines.push(`  ${v.file}:${v.line} — ${v.pattern} — matched "${v.match}"`);
  }
  return lines.join('\n');
}
