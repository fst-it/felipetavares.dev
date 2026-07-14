/**
 * Build-time loader for the Selfwright project's machine-readable metrics manifest.
 *
 * The manifest is published by the Selfwright repo itself at a raw GitHub URL. This site has
 * no control over that repo's publish schedule — the URL may 404 (repo not public yet), time
 * out, or return a shape that doesn't match what this site expects. None of that may ever break
 * `astro build`: any failure falls back to a committed local copy validated with the same schema.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const MANIFEST_URL = 'https://raw.githubusercontent.com/fst-it/Selfwright/main/metrics.json';
const FALLBACK_PATH = resolve(process.cwd(), 'content/metrics/selfwright-manifest.json');
const FETCH_TIMEOUT_MS = 5000;

export const selfwrightManifestSchema = z.object({
  schemaVersion: z.number(),
  version: z.string(),
  fitnessChecks: z.object({
    ci: z.number(),
    total: z.number(),
  }),
  scanProviders: z.number(),
  tests: z.number(),
  generatedAt: z.string(),
  commit: z.string(),
});

export type SelfwrightManifest = z.infer<typeof selfwrightManifestSchema>;

export interface SelfwrightMetricsResult {
  manifest: SelfwrightManifest;
  source: 'remote' | 'fallback';
}

async function fetchRemoteManifest(): Promise<SelfwrightManifest | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(MANIFEST_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = selfwrightManifestSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    // Network error, timeout (abort), or malformed JSON — all treated as "no remote manifest".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadFallbackManifest(): Promise<SelfwrightManifest> {
  const raw = await readFile(FALLBACK_PATH, 'utf-8');
  const parsed = selfwrightManifestSchema.parse(JSON.parse(raw));
  return parsed;
}

/**
 * Resolves the Selfwright metrics manifest, preferring the live remote copy and falling back to
 * the committed local snapshot on any failure. Never throws — the fallback file is committed and
 * schema-validated in this repo's own test suite, so a fallback read failure would indicate a
 * genuine repo bug rather than a transient condition, and is allowed to surface as a build error.
 */
export async function loadSelfwrightMetrics(): Promise<SelfwrightMetricsResult> {
  const remote = await fetchRemoteManifest();
  if (remote) {
    return { manifest: remote, source: 'remote' };
  }
  const fallback = await loadFallbackManifest();
  return { manifest: fallback, source: 'fallback' };
}
