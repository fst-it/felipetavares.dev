/**
 * Selfwright metrics curation (build stage: "Selfwright eval surface"). Pure schema + deny-list
 * logic lives here (no filesystem/process access) so it's unit-testable, mirroring the
 * redaction-gate split: `scripts/import-selfwright-metrics.ts` is the thin CLI that reads the
 * local Selfwright repo and calls `assertNoDeniedContent` before writing
 * `content/metrics/selfwright.json`.
 *
 * Approved metric groups ONLY: eval-suite pass rates, runtime/cost statistics
 * (deterministic-vs-LLM split). Hard exclusion:
 * pipeline volume, application counts, or anything revealing job-search activity — Selfwright-data
 * (the private repo holding `applications/`, `pipeline/`, `contacts/`) must never be a source for
 * this snapshot at all; the deny-list below is a second, explicit backstop against that category
 * of fact leaking in even from an approved source (e.g. a doc that mentions a company name).
 */
import { z } from 'zod';

export const metricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const metricGroupSchema = z.object({
  title: z.string().min(1),
  metrics: z.array(metricSchema).min(1),
  source: z.string().min(1),
});

export const selfwrightMetricsSnapshotSchema = z.object({
  capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'capturedAt must be an ISO YYYY-MM-DD date'),
  groups: z.array(metricGroupSchema),
});

export type MetricInput = z.infer<typeof metricSchema>;

/**
 * Deny-list: substrings that must never appear in a curated metric's `label`, `value`, or
 * `source` field. Two categories per the stage brief's hard exclusion:
 *  1. Pipeline-volume / application-count language — the thing itself, regardless of number.
 *  2. Named companies/roles from Selfwright's acceptance-test docs (Trafigura, Booking, Citi,
 *     Bain, BCG, Aviva) — those docs are a legitimate *aggregated* source (ATS pass rate, holistic
 *     fit range) but a per-company/per-role breakdown would reveal which employers were targeted,
 *     which is job-search-activity information even without a headcount or dollar figure attached.
 */
export const DENY_LIST: string[] = [
  // Pipeline volume / application-count / job-search-activity language.
  'applications submitted',
  'application count',
  'pipeline volume',
  'roles applied',
  'jobs applied',
  'applications sent',
  'application queue',
  'interview-conversion rate',
  'interview conversion',
  // Named target companies/roles that appear in Selfwright's acceptance-test docs — approved as
  // an aggregate ("all acceptance roles"), never as a named breakdown.
  'Trafigura',
  'Booking.com',
  'Booking Director',
  'Aviva',
  'Citi',
  'Bain',
  'BCG',
];

export interface DeniedContentViolation {
  group: string;
  field: 'label' | 'value' | 'source';
  match: string;
}

/**
 * Scans a candidate list of metric groups for deny-listed substrings (case-insensitive). Returns
 * every violation found — does not throw — so the caller (the CLI script) can print a full report
 * before failing, and so a test can assert on the exact violations returned rather than only on
 * whether an exception was thrown.
 */
export function findDeniedContent(groups: MetricGroup[]): DeniedContentViolation[] {
  const violations: DeniedContentViolation[] = [];

  for (const group of groups) {
    for (const metric of group.metrics) {
      violations.push(...scanField(group.title, 'label', metric.label));
      violations.push(...scanField(group.title, 'value', metric.value));
    }
    violations.push(...scanField(group.title, 'source', group.source));
  }

  return violations;
}

function scanField(groupTitle: string, field: DeniedContentViolation['field'], text: string): DeniedContentViolation[] {
  const lowerText = text.toLowerCase();
  const hits: DeniedContentViolation[] = [];
  for (const denied of DENY_LIST) {
    if (lowerText.includes(denied.toLowerCase())) {
      hits.push({ group: groupTitle, field, match: denied });
    }
  }
  return hits;
}

/** Minimal shape `findDeniedContent`/`selfwrightMetricsSnapshotSchema` operate over. */
export interface MetricGroup {
  title: string;
  metrics: MetricInput[];
  source: string;
}

/** Throws with a formatted report if any group contains deny-listed content. Used by the CLI. */
export function assertNoDeniedContent(groups: MetricGroup[]): void {
  const violations = findDeniedContent(groups);
  if (violations.length === 0) return;

  const lines = [`Selfwright metrics deny-list: ${violations.length} violation(s) found:`];
  for (const v of violations) {
    lines.push(`  [${v.group}] ${v.field} contains denied term "${v.match}"`);
  }
  throw new Error(lines.join('\n'));
}
