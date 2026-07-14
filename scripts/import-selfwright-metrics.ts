#!/usr/bin/env tsx
/**
 * Selfwright metrics importer (build stage: "Selfwright eval surface"). Reads the LOCAL
 * Selfwright repo (pass `--selfwright-dir=<path>` or set SELFWRIGHT_DIR) and writes a
 * curated snapshot to `content/metrics/selfwright.json`.
 *
 * What it does, concretely:
 *   1. Runs `pnpm fitness` in the Selfwright repo and parses the tier-1 (CI-safe, no private
 *      data required) pass/skip/fail counts from its own stdout summary line.
 *   2. Runs `pnpm --filter @selfwright/core test -- --run` and parses Vitest's own
 *      "Test Files"/"Tests" summary lines.
 *   3. Reads `docs/metrics.md` for the one runtime/cost fact that doc actually states: under the
 *      ADR-0006 subscription-only pivot, the LLM tier has no metered per-call cost by design.
 *
 * Every group above is gated through `assertNoDeniedContent` (src/core/services/
 * selfwright-metrics-curation.ts) before being written — pipeline volume, application counts, and
 * named target companies/roles are hard-excluded, never fabricated as a substitute.
 *
 * `capturedAt` is passed via `--date=YYYY-MM-DD`, or falls back to the latest Selfwright commit
 * date found by this script (never `Date.now()`).
 *
 * Usage: pnpm import-selfwright-metrics [--date=2026-07-06] --selfwright-dir=<path>
 */
import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  selfwrightMetricsSnapshotSchema,
  assertNoDeniedContent,
  type MetricGroup,
} from '../src/core/services/selfwright-metrics-curation';

const REPO_ROOT = process.cwd();
const OUT_PATH = path.join(REPO_ROOT, 'content/metrics/selfwright.json');

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

function getSelfwrightDir(): string {
  const dir = parseArg('selfwright-dir') ?? process.env['SELFWRIGHT_DIR'];
  if (!dir) {
    throw new Error(
      '--selfwright-dir=<path> is required (or set the SELFWRIGHT_DIR environment variable).',
    );
  }
  if (!existsSync(dir)) {
    throw new Error(`Selfwright repo not found at ${dir} — check the path.`);
  }
  return dir;
}

function getSelfwrightCommit(selfwrightDir: string): { hash: string; date: string } {
  const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: selfwrightDir, encoding: 'utf-8' }).trim();
  const date = execFileSync('git', ['log', '-1', '--format=%ad', '--date=short'], {
    cwd: selfwrightDir,
    encoding: 'utf-8',
  }).trim();
  return { hash, date };
}

/** Runs `pnpm fitness` in the Selfwright repo and parses its own summary line, e.g.
 *  "17 passed · 2 skipped (SELFWRIGHT_DATA_DIR not configured) · 0 failed". */
function runFitnessSuite(selfwrightDir: string): { passed: number; skipped: number; failed: number } {
  let output: string;
  try {
    output = execFileSync('pnpm', ['--filter', '@selfwright/fitness', 'fitness'], {
      cwd: selfwrightDir,
      encoding: 'utf-8',
      // pnpm resolves via a .cmd shim on Windows — execFileSync needs shell:true to find it
      // (same fix as scripts/build-chat-index.ts's spawnSync('wrangler', ...) call).
      shell: true,
      // Explicitly unset so a developer's shell env never leaks Tier-2 private-data access into
      // this snapshot — only the CI-safe Tier-1 result this script is approved to import.
      env: { ...process.env, SELFWRIGHT_DATA_DIR: '' },
    });
  } catch (err) {
    // execFileSync throws on non-zero exit; a failed fitness run still has stdout worth parsing,
    // but treat it as a hard error here — this script must never import a red suite as if green.
    throw new Error(`pnpm fitness failed in ${selfwrightDir}:\n${(err as { stdout?: string }).stdout ?? err}`);
  }

  // Strip ANSI color codes turbo/the runner prints before matching.
  // eslint-disable-next-line no-control-regex
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const match = clean.match(/(\d+)\s+passed[^\d]+(\d+)\s+skipped[^\d]+(\d+)\s+failed/);
  if (!match) {
    throw new Error(`Could not parse fitness suite summary from output:\n${clean.slice(-500)}`);
  }
  return { passed: Number(match[1]), skipped: Number(match[2]), failed: Number(match[3]) };
}

/** Runs the deterministic-core unit test suite and parses Vitest's "Test Files"/"Tests" lines. */
function runUnitTestSuite(selfwrightDir: string): { files: number; tests: number } {
  let output: string;
  try {
    output = execFileSync('pnpm', ['--filter', '@selfwright/core', 'test', '--', '--run'], {
      cwd: selfwrightDir,
      encoding: 'utf-8',
      shell: true,
    });
  } catch (err) {
    throw new Error(`Selfwright unit test suite failed in ${selfwrightDir}:\n${(err as { stdout?: string }).stdout ?? err}`);
  }

  // eslint-disable-next-line no-control-regex
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const filesMatch = clean.match(/Test Files\s+(\d+)\s+passed/);
  const testsMatch = clean.match(/\bTests\s+(\d+)\s+passed/);
  if (!filesMatch || !testsMatch) {
    throw new Error(`Could not parse unit test summary from output:\n${clean.slice(-800)}`);
  }
  return { files: Number(filesMatch[1]), tests: Number(testsMatch[1]) };
}

async function main() {
  const selfwrightDir = getSelfwrightDir();
  const commit = getSelfwrightCommit(selfwrightDir);
  const capturedAt = parseArg('date') ?? commit.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(capturedAt)) {
    throw new Error(`--date must be YYYY-MM-DD, got "${capturedAt}"`);
  }

  console.log(`[import-selfwright-metrics] Reading ${selfwrightDir} @ ${commit.hash} (${commit.date})...`);

  const fitness = runFitnessSuite(selfwrightDir);
  console.log(`[import-selfwright-metrics] Fitness suite: ${fitness.passed} passed, ${fitness.skipped} skipped, ${fitness.failed} failed.`);

  const unitTests = runUnitTestSuite(selfwrightDir);
  console.log(`[import-selfwright-metrics] Unit tests: ${unitTests.files} files, ${unitTests.tests} tests passed.`);

  // Groups built only from what was actually found above — no group is added speculatively.
  // Approved categories: eval-suite pass rates, runtime/cost statistics (deterministic-vs-LLM split).
  const groups: MetricGroup[] = [
    {
      title: 'Eval-suite pass rate — fitness functions',
      metrics: [
        { label: 'Tier-1 checks (CI-safe, no private data)', value: `${fitness.passed} passed · ${fitness.failed} failed` },
        { label: 'Tier-2 checks (need local truth-layer data)', value: `${fitness.skipped} skipped` },
      ],
      source: `Selfwright \`pnpm fitness\` @ ${commit.hash}`,
    },
    {
      title: 'Eval-suite pass rate — deterministic-core unit tests',
      metrics: [{ label: 'Tests passed', value: `${unitTests.tests} / ${unitTests.tests} across ${unitTests.files} files` }],
      source: `Selfwright \`pnpm --filter @selfwright/core test\` @ ${commit.hash}`,
    },
    {
      title: 'Runtime/cost — deterministic vs. LLM tier',
      metrics: [
        { label: 'Deterministic tier (ATS, scoring, tailoring, fitness)', value: '$0 — no LLM call' },
        { label: 'LLM tier (cover/research, co-piloted)', value: '$0 metered — subscription-based, no per-call API billing (ADR 0006)' },
      ],
      source: 'Selfwright docs/metrics.md',
    },
  ];

  assertNoDeniedContent(groups);

  const snapshot = { capturedAt, groups };
  const parsed = selfwrightMetricsSnapshotSchema.parse(snapshot);

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
  console.log(`[import-selfwright-metrics] Wrote ${parsed.groups.length} group(s) to ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error('[import-selfwright-metrics] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
