import { describe, it, expect } from 'vitest';
import { buildProfile } from '../profile';

describe('buildProfile', () => {
  it('sorts domains by descending weight and maps to {name, blurb}', () => {
    const profile = buildProfile({
      name: 'Felipe Tavares',
      siteUrl: 'https://felipetavares.dev',
      positioning: { statement: 'Enterprise architecture leader.' },
      skillDomains: [
        { name: 'Low weight', blurb: 'b1', weight: 1 },
        { name: 'High weight', blurb: 'b2', weight: 10 },
      ],
      socialLinks: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/x', icon: 'linkedin' }],
    });

    expect(profile.domains.map((d) => d.name)).toEqual(['High weight', 'Low weight']);
    expect(profile.domains[0]).toEqual({ name: 'High weight', blurb: 'b2' });
  });

  it('passes through name, positioning statement, links, and url unchanged', () => {
    const profile = buildProfile({
      name: 'Felipe Tavares',
      siteUrl: 'https://felipetavares.dev',
      positioning: { statement: 'Statement text.' },
      skillDomains: [],
      socialLinks: [{ label: 'GitHub', url: 'https://github.com/x', icon: 'github' }],
    });

    expect(profile.name).toBe('Felipe Tavares');
    expect(profile.positioning).toBe('Statement text.');
    expect(profile.url).toBe('https://felipetavares.dev');
    expect(profile.links).toEqual([{ label: 'GitHub', url: 'https://github.com/x', icon: 'github' }]);
  });

  it('handles empty skill domains without throwing', () => {
    const profile = buildProfile({
      name: 'Felipe Tavares',
      siteUrl: 'https://felipetavares.dev',
      positioning: { statement: 'x' },
      skillDomains: [],
      socialLinks: [],
    });
    expect(profile.domains).toEqual([]);
  });
});
