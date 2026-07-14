import { describe, it, expect } from 'vitest';
import {
  loadArticles,
  loadArticle,
  loadProjects,
  loadProject,
  loadRoles,
  loadPositioning,
  loadSkillDomains,
  loadSocialLinks,
  loadDossier,
} from '../content-loader';

describe('content-loader (reads content/ off disk, mirrors GitContentRepository shape)', () => {
  it('loads published articles only, most recent first', async () => {
    const articles = await loadArticles();
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((a) => a.draft === false)).toBe(true);
    for (let i = 1; i < articles.length; i++) {
      expect(articles[i - 1].pubDate.getTime()).toBeGreaterThanOrEqual(articles[i].pubDate.getTime());
    }
  });

  it('loadArticle resolves a known slug and returns undefined for an unknown one', async () => {
    const articles = await loadArticles();
    const known = articles[0].slug;
    const found = await loadArticle(known);
    expect(found?.slug).toBe(known);

    const missing = await loadArticle('this-slug-does-not-exist-anywhere');
    expect(missing).toBeUndefined();
  });

  it('loads projects ordered by `order`, including the known selfwright project', async () => {
    const projects = await loadProjects();
    expect(projects.some((p) => p.slug === 'selfwright')).toBe(true);
    for (let i = 1; i < projects.length; i++) {
      expect(projects[i].order).toBeGreaterThanOrEqual(projects[i - 1].order);
    }
  });

  it('loadProject resolves a known slug and returns undefined for an unknown one', async () => {
    const project = await loadProject('selfwright');
    expect(project?.title).toBe('Selfwright');
    expect(await loadProject('not-a-real-project')).toBeUndefined();
  });

  it('loads roles ordered by `order`', async () => {
    const roles = await loadRoles();
    expect(roles.length).toBeGreaterThan(0);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i].order).toBeGreaterThanOrEqual(roles[i - 1].order);
    }
  });

  it('loads the site singleton (positioning, skill domains, social links, dossier)', async () => {
    const [positioning, domains, links, dossier] = await Promise.all([
      loadPositioning(),
      loadSkillDomains(),
      loadSocialLinks(),
      loadDossier(),
    ]);

    expect(positioning.statement.length).toBeGreaterThan(0);
    expect(domains.length).toBe(12);
    for (let i = 1; i < domains.length; i++) {
      expect(domains[i - 1].weight).toBeGreaterThanOrEqual(domains[i].weight);
    }
    expect(links.length).toBeGreaterThan(0);
    expect(dossier.competencyMatrix.length).toBeGreaterThan(0);
  });
});
