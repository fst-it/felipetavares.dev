import { describe, it, expect } from 'vitest';
import { listProjects } from '../list-projects';

describe('list_projects', () => {
  it('lists every project with metadata but no MDX body', async () => {
    const projects = await listProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.some((p) => p.slug === 'selfwright')).toBe(true);
    for (const p of projects) {
      expect(p).not.toHaveProperty('body');
      expect(p).not.toHaveProperty('deepDive');
      expect(['active', 'archived', 'incubating']).toContain(p.status);
    }
  });
});
