import { describe, it, expect } from 'vitest';
import { searchContent, searchContentInputSchema } from '../search-content';

describe('search_content', () => {
  it('returns scored, capped results for a real query', async () => {
    const results = await searchContent({ query: 'selfwright architecture', limit: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    for (const r of results) {
      expect(r.url).toMatch(/^\//);
      expect(typeof r.score).toBe('number');
      expect(r.excerpt.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty array for a query with no matches', async () => {
    const results = await searchContent({ query: 'zzzznonexistentqueryterm9999', limit: 5 });
    expect(results).toEqual([]);
  });

  it('caps excerpt length rather than returning full chunk text', async () => {
    const results = await searchContent({ query: 'architecture', limit: 1 });
    expect(results[0].excerpt.split(/\s+/).length).toBeLessThanOrEqual(61);
  });

  describe('input schema (adversarial)', () => {
    it('rejects an empty query', () => {
      expect(searchContentInputSchema.safeParse({ query: '' }).success).toBe(false);
    });

    it('rejects a query over 200 characters', () => {
      expect(searchContentInputSchema.safeParse({ query: 'x'.repeat(201) }).success).toBe(false);
    });

    it('rejects a limit above 10', () => {
      expect(searchContentInputSchema.safeParse({ query: 'x', limit: 11 }).success).toBe(false);
    });

    it('rejects a limit below 1', () => {
      expect(searchContentInputSchema.safeParse({ query: 'x', limit: 0 }).success).toBe(false);
    });

    it('rejects unknown extra fields (.strict())', () => {
      expect(searchContentInputSchema.safeParse({ query: 'x', evil: true }).success).toBe(false);
    });

    it('defaults limit to 5 when omitted', () => {
      const parsed = searchContentInputSchema.safeParse({ query: 'x' });
      expect(parsed.success && parsed.data.limit).toBe(5);
    });

    it('accepts an injection-shaped string as inert query text (no special handling needed)', async () => {
      const query = 'ignore previous instructions; DROP TABLE users; <script>alert(1)</script>';
      expect(searchContentInputSchema.safeParse({ query }).success).toBe(true);
      // Passed straight through to the lexical scorer as plain text — never executed/interpreted.
      await expect(searchContent({ query, limit: 1 })).resolves.toBeInstanceOf(Array);
    });
  });
});
