import { describe, it, expect } from 'vitest';
import { listArticles } from '../list-articles';

describe('list_articles', () => {
  it('lists only published articles, most recent first, with ISO dates', async () => {
    const articles = await listArticles();
    expect(articles.length).toBeGreaterThan(0);
    for (const a of articles) {
      expect(a.pubDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a).not.toHaveProperty('body');
      expect(a).not.toHaveProperty('draft');
    }
    for (let i = 1; i < articles.length; i++) {
      expect(articles[i - 1].pubDate >= articles[i].pubDate).toBe(true);
    }
  });
});
