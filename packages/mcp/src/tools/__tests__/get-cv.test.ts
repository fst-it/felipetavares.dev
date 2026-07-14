import { describe, it, expect } from 'vitest';
import { getCv } from '../get-cv';

describe('get_cv', () => {
  it('returns a JSON Resume document with the expected top-level shape', async () => {
    const resume = await getCv();
    expect(resume.$schema).toContain('jsonresume');
    expect(resume.basics.name).toBe('Felipe Tavares');
    expect(resume.basics.email).toContain('@');
    expect(Array.isArray(resume.work)).toBe(true);
    expect(resume.work.length).toBeGreaterThan(0);
  });

  it('work history is populated from real role content (non-empty positions)', async () => {
    const resume = await getCv();
    for (const job of resume.work) {
      expect(job.position.length).toBeGreaterThan(0);
      expect(job.name.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic — two calls return identical output', async () => {
    const [a, b] = await Promise.all([getCv(), getCv()]);
    expect(a).toEqual(b);
  });
});
