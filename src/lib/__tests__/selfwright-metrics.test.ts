import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSelfwrightMetrics, selfwrightManifestSchema } from '../selfwright-metrics';

const validManifest = {
  schemaVersion: 1,
  version: '0.6.0',
  fitnessChecks: { ci: 28, total: 33 },
  scanProviders: 19,
  tests: 2067,
  generatedAt: '2026-07-14',
  commit: 'ea66fa8',
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('loadSelfwrightMetrics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the remote manifest when the fetch succeeds and validates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(validManifest)));

    const result = await loadSelfwrightMetrics();

    expect(result.source).toBe('remote');
    expect(result.manifest).toEqual(validManifest);
  });

  it('falls back to the committed manifest on a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));

    const result = await loadSelfwrightMetrics();

    expect(result.source).toBe('fallback');
    expect(selfwrightManifestSchema.safeParse(result.manifest).success).toBe(true);
  });

  it('falls back to the committed manifest when the remote payload fails schema validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ nonsense: true })));

    const result = await loadSelfwrightMetrics();

    expect(result.source).toBe('fallback');
    expect(selfwrightManifestSchema.safeParse(result.manifest).success).toBe(true);
  });

  it('falls back to the committed manifest on a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unreachable'))
    );

    const result = await loadSelfwrightMetrics();

    expect(result.source).toBe('fallback');
    expect(selfwrightManifestSchema.safeParse(result.manifest).success).toBe(true);
  });
});
