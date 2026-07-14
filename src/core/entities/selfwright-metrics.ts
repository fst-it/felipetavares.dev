/**
 * Selfwright metrics snapshot entity (see `src/core/services/selfwright-metrics-curation.ts` for
 * the deny-list guard, and `scripts/import-selfwright-metrics.ts` for the CLI that populates
 * `content/metrics/selfwright.json` from the local Selfwright repo). One stat-tile group per
 * `MetricGroup`; a group is only ever added if real data was found — never fabricated (per
 * `docs/adr/0002-single-source-of-truth.md` and this repo's "content facts are never invented"
 * rule).
 */

export interface Metric {
  label: string;
  value: string;
}

export interface MetricGroup {
  /** Short heading for the stat-tile group, e.g. "Fitness functions (tier 1, CI-safe)". */
  title: string;
  metrics: Metric[];
  /** One-line provenance note shown under the group, e.g. "Selfwright commit dc69858, `pnpm fitness`". */
  source: string;
}

export interface SelfwrightMetricsSnapshot {
  /** Date the snapshot was captured/curated (ISO `YYYY-MM-DD`) — never `Date.now()` at render time. */
  capturedAt: string;
  groups: MetricGroup[];
}
