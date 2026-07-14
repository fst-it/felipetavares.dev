import { describe, it, expect } from 'vitest';
import { getProfile } from '../get-profile';

describe('get_profile', () => {
  it('returns the 12 domains, positioning statement, and links', async () => {
    const profile = await getProfile();
    expect(profile.name).toBe('Felipe Tavares');
    expect(profile.positioning.length).toBeGreaterThan(0);
    expect(profile.domains).toHaveLength(12);
    expect(profile.links.length).toBeGreaterThan(0);
  });

  it('domains are ordered by descending prominence weight', async () => {
    const profile = await getProfile();
    // AI & Agentic Engineering is the highest-weight domain in content/site/site.json.
    expect(profile.domains[0].name).toBe('AI & Agentic Engineering');
  });
});
