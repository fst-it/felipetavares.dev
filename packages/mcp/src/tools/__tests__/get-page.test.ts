import { describe, it, expect } from 'vitest';
import { getPage, getPageInputSchema } from '../get-page';

function isError(result: Awaited<ReturnType<typeof getPage>>): result is { error: string } {
  return 'error' in result;
}

describe('get_page', () => {
  it('returns markdown for every static allow-listed path', async () => {
    const staticPaths = ['/', '/experience', '/experience/dossier', '/speaking', '/contact', '/engineering'];
    for (const path of staticPaths) {
      const result = await getPage({ path });
      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.path).toBe(path);
        expect(result.markdown.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns engineering hub markdown with decisions, stack, and changelog sections', async () => {
    const result = await getPage({ path: '/engineering' });
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.markdown).toContain('# Engineering');
      expect(result.markdown).toContain('## Decisions');
      expect(result.markdown).toContain('## Why this stack');
      expect(result.markdown).toContain('## Changelog');
    }
  });

  it('returns markdown for a known project slug', async () => {
    const result = await getPage({ path: '/projects/selfwright' });
    expect(isError(result)).toBe(false);
    if (!isError(result)) expect(result.markdown).toContain('Selfwright');
  });

  it('returns markdown for a known article slug', async () => {
    const result = await getPage({ path: '/writing/why-i-built-this-site-the-way-i-did' });
    expect(isError(result)).toBe(false);
    if (!isError(result)) expect(result.markdown.length).toBeGreaterThan(0);
  });

  it('returns a structured {error}, not a crash, for an unknown project slug', async () => {
    const result = await getPage({ path: '/projects/does-not-exist' });
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.error).toContain('No project found');
  });

  it('returns a structured {error}, not a crash, for an unknown article slug', async () => {
    const result = await getPage({ path: '/writing/does-not-exist' });
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.error).toContain('No article found');
  });

  it('returns a structured {error} for any unrecognized path, never touching the filesystem', async () => {
    const result = await getPage({ path: '/some/random/nonsense' });
    expect(isError(result)).toBe(true);
  });

  describe('path traversal / adversarial input', () => {
    const traversalAttempts = [
      '../../../etc/passwd',
      '/../../etc/passwd',
      '/projects/../../../etc/passwd',
      '/projects/..%2f..%2fetc%2fpasswd',
      '/writing/../../.env',
      '/projects/selfwright/../../../secrets',
      'C:\\Windows\\System32\\config\\SAM',
      '/\0/etc/passwd',
    ];

    for (const attempt of traversalAttempts) {
      it(`rejects "${attempt}" as an unknown path (no filesystem access)`, async () => {
        const parsed = getPageInputSchema.safeParse({ path: attempt });
        if (!parsed.success) {
          // Rejected at the schema layer (e.g. null byte) — also a valid safe outcome.
          expect(parsed.success).toBe(false);
          return;
        }
        const result = await getPage(parsed.data);
        expect(isError(result)).toBe(true);
      });
    }

    it('rejects a path over 200 characters at the schema layer', () => {
      expect(getPageInputSchema.safeParse({ path: '/' + 'a'.repeat(200) }).success).toBe(false);
    });

    it('rejects an empty path at the schema layer', () => {
      expect(getPageInputSchema.safeParse({ path: '' }).success).toBe(false);
    });

    it('rejects unknown extra fields (.strict())', () => {
      expect(getPageInputSchema.safeParse({ path: '/', evil: true }).success).toBe(false);
    });

    it('project/article slug matching only accepts a restricted charset (a-z0-9-), so an injected slug never reaches the filesystem', async () => {
      const result = await getPage({ path: '/projects/../../etc' });
      expect(isError(result)).toBe(true);
    });
  });
});
