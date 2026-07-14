import { describe, it, expect } from 'vitest';
import {
  selfwrightMetricsSnapshotSchema,
  findDeniedContent,
  assertNoDeniedContent,
  DENY_LIST,
} from '../selfwright-metrics-curation';

describe('selfwrightMetricsSnapshotSchema', () => {
  it('validates a well-formed snapshot', () => {
    const result = selfwrightMetricsSnapshotSchema.safeParse({
      capturedAt: '2026-07-03',
      groups: [
        {
          title: 'Fitness functions',
          metrics: [{ label: 'Tier-1 checks', value: '17 passed · 0 failed' }],
          source: 'Selfwright `pnpm fitness`',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a capturedAt that is not an ISO YYYY-MM-DD date', () => {
    const result = selfwrightMetricsSnapshotSchema.safeParse({
      capturedAt: '07/03/2026',
      groups: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a group with an empty metrics array', () => {
    const result = selfwrightMetricsSnapshotSchema.safeParse({
      capturedAt: '2026-07-03',
      groups: [{ title: 'Empty group', metrics: [], source: 'nowhere' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a metric with an empty label or value', () => {
    const result = selfwrightMetricsSnapshotSchema.safeParse({
      capturedAt: '2026-07-03',
      groups: [{ title: 'Group', metrics: [{ label: '', value: '1' }], source: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  it('allows an empty groups array (graceful omission when no real data is found)', () => {
    const result = selfwrightMetricsSnapshotSchema.safeParse({ capturedAt: '2026-07-03', groups: [] });
    expect(result.success).toBe(true);
  });
});

describe('findDeniedContent — pipeline volume / application activity', () => {
  it('flags application-count language in a metric value', () => {
    const violations = findDeniedContent([
      { title: 'Group', metrics: [{ label: 'Applications', value: '12 applications submitted' }], source: 'x' },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ group: 'Group', field: 'value' });
  });

  it('flags application-count language in a metric label', () => {
    const violations = findDeniedContent([
      { title: 'Group', metrics: [{ label: 'Application count this month', value: '5' }], source: 'x' },
    ]);
    expect(violations.some((v) => v.field === 'label')).toBe(true);
  });

  it('flags pipeline-volume language', () => {
    const violations = findDeniedContent([
      { title: 'Group', metrics: [{ label: 'Volume', value: 'pipeline volume up this week' }], source: 'x' },
    ]);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('flags interview-conversion-rate language (the north-star metric — explicitly job-search-activity-shaped)', () => {
    const violations = findDeniedContent([
      { title: 'Group', metrics: [{ label: 'Conversion', value: 'interview-conversion rate improved' }], source: 'x' },
    ]);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const violations = findDeniedContent([
      { title: 'Group', metrics: [{ label: 'x', value: 'APPLICATIONS SUBMITTED: many' }], source: 'x' },
    ]);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('findDeniedContent — named target companies/roles', () => {
  it.each(['Trafigura', 'Booking.com', 'Aviva', 'Citi', 'Bain', 'BCG'])(
    'flags "%s" appearing in a metric value',
    (company) => {
      const violations = findDeniedContent([
        { title: 'Group', metrics: [{ label: 'Role', value: `Applied at ${company}` }], source: 'x' },
      ]);
      expect(violations.length).toBeGreaterThan(0);
    }
  );

  it('flags a named company in the source field, not only label/value', () => {
    const violations = findDeniedContent([
      { title: 'Group', metrics: [{ label: 'ATS', value: '1.00' }], source: 'Trafigura acceptance run' },
    ]);
    expect(violations.some((v) => v.field === 'source')).toBe(true);
  });
});

describe('findDeniedContent — clean content passes', () => {
  it('does not flag an aggregated, anonymized ATS pass rate', () => {
    const violations = findDeniedContent([
      {
        title: 'ATS pass-through',
        metrics: [{ label: 'ATS pass rate (acceptance roles, ≥0.80 gate)', value: '100%' }],
        source: 'Selfwright phase1-acceptance-test-2026-06-30.md',
      },
    ]);
    expect(violations).toHaveLength(0);
  });

  it('does not flag a deterministic fitness-suite pass count', () => {
    const violations = findDeniedContent([
      {
        title: 'Fitness functions (tier 1, CI-safe)',
        metrics: [{ label: 'Checks passed', value: '17 passed · 0 failed' }],
        source: 'Selfwright `pnpm fitness`, 2026-07-06',
      },
    ]);
    expect(violations).toHaveLength(0);
  });

  it('does not flag a holistic fit range with no company attached', () => {
    const violations = findDeniedContent([
      {
        title: 'Fit-score demonstrations',
        metrics: [{ label: 'Holistic fit (LLM-tier DoD close-out roles)', value: '4.6-4.7 / 5.0' }],
        source: 'Selfwright phase2-t2.2-dod-closeout-2026-07-03.md',
      },
    ]);
    expect(violations).toHaveLength(0);
  });
});

describe('assertNoDeniedContent', () => {
  it('does not throw for clean groups', () => {
    expect(() =>
      assertNoDeniedContent([{ title: 'Group', metrics: [{ label: 'x', value: '100%' }], source: 'y' }])
    ).not.toThrow();
  });

  it('throws with a report naming the group, field, and matched term when violated', () => {
    expect(() =>
      assertNoDeniedContent([
        { title: 'Bad group', metrics: [{ label: 'x', value: 'applications submitted: 12' }], source: 'y' },
      ])
    ).toThrow(/Bad group.*applications submitted/s);
  });
});

describe('DENY_LIST', () => {
  it('is non-empty and includes both exclusion categories from the stage brief', () => {
    expect(DENY_LIST.length).toBeGreaterThan(0);
    expect(DENY_LIST.some((d) => /application/i.test(d))).toBe(true);
    expect(DENY_LIST).toContain('Trafigura');
  });
});
