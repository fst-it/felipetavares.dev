import { describe, it, expect } from 'vitest';
import { scanText, formatReport } from '../redaction-gate';

describe('scanText', () => {
  it('flags an explicitly redacted historical figure', () => {
    // Matches both the specific "$80M" pattern and the generic currency-magnitude pattern —
    // both are legitimate, independent hits on the same text.
    const violations = scanText('content/roles/example.json', 'Delivered a $80M cost saving.');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.pattern.includes('$80M') && v.match === '$80M')).toBe(true);
  });

  it('flags generic currency-magnitude figures not on the explicit list', () => {
    const violations = scanText('content/roles/example.json', 'Owned a €3.2M budget line.');
    expect(violations.some((v) => v.pattern.startsWith('currency-magnitude'))).toBe(true);
  });

  it('flags company-tied headcount patterns', () => {
    const violations = scanText('content/roles/example.json', 'Managed a team of 9 direct reports.');
    expect(violations.some((v) => v.pattern.includes('9 direct'))).toBe(true);
  });

  it('does not flag the approved anonymized org-shape exception', () => {
    const violations = scanText(
      'content/site/site.json',
      'Functional direction over a large org (typically ≈10 direct, 20+ dotted-line).'
    );
    expect(violations).toHaveLength(0);
  });

  it('passes clean, non-financial text with no violations', () => {
    const violations = scanText(
      'content/projects/example.mdx',
      'Cut integration cost by more than half and tripled delivery throughput across 17+ years.'
    );
    expect(violations).toHaveLength(0);
  });

  it('reports correct line numbers for multi-line files', () => {
    const text = 'line one\nline two\nBudget was $55M this year\nline four';
    const violations = scanText('content/articles/example.mdx', text);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.every((v) => v.line === 3)).toBe(true);
  });

  // V3b addendum commit 2 (AI-ready layers): markdown twins (dist/**/*.md) and /api/cv.json
  // (dist/**/*.json) are new build artifacts scanned by the same CLI walk as dist/**/*.html.
  // scanText itself is extension-agnostic — these two cases confirm it catches a leak in the
  // exact textual shapes those artifacts take (plain markdown, JSON Resume's `highlights` array).
  it('flags a forbidden figure inside markdown-twin-shaped content', () => {
    const markdown = '### Example Role · Example Co\n\n- **$80M cost saving:** delivered under budget.\n';
    const violations = scanText('dist/experience/index.md', markdown);
    expect(violations.some((v) => v.match === '$80M')).toBe(true);
  });

  it('flags a forbidden figure inside JSON-Resume-shaped content', () => {
    const json = JSON.stringify({ work: [{ highlights: ['Managed a team of 9 direct reports.'] }] });
    const violations = scanText('dist/api/cv.json', json);
    expect(violations.some((v) => v.pattern.includes('9 direct'))).toBe(true);
  });
});

// Item 1 (2026-07-06 refinement): selfwright DENY_LIST terms are now also gate patterns.
// Proves that a metrics-shaped leak through an approved source (e.g. a misused label field)
// would be caught by the public-site gate, not just by the import-time deny-list check.
describe('scanText — selfwright deny-list patterns', () => {
  it('flags a pipeline-volume phrase that would reveal job-search activity', () => {
    const violations = scanText('dist/projects/selfwright.md', 'Total applications submitted: 47.');
    expect(violations.some((v) => v.pattern.includes('applications submitted'))).toBe(true);
  });

  it('flags a named target company that appears as a per-company breakdown', () => {
    const violations = scanText('dist/api/cv.json', '{"label":"Trafigura fit score","value":"93%"}');
    expect(violations.some((v) => v.pattern.includes('Trafigura'))).toBe(true);
  });

  it('flags an interview-conversion phrase', () => {
    const violations = scanText('content/metrics/selfwright.json', 'interview-conversion rate: 40%');
    expect(violations.some((v) => v.pattern.includes('interview-conversion rate'))).toBe(true);
  });

  it('does not flag clean eval metrics that are in the approved group', () => {
    const violations = scanText('content/metrics/selfwright.json', 'ATS pass-through: 94% across all test roles.');
    expect(violations).toHaveLength(0);
  });
});

describe('formatReport', () => {
  it('reports a clean pass when there are no violations', () => {
    expect(formatReport([])).toContain('no forbidden patterns found');
  });

  it('lists each violation with file, line, and pattern', () => {
    const report = formatReport([
      { file: 'content/roles/x.json', pattern: 'redacted figure: $80M', match: '$80M', line: 4 },
    ]);
    expect(report).toContain('content/roles/x.json:4');
    expect(report).toContain('$80M');
  });
});
