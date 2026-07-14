import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { contentRepository, siteConfig } from '../config/site';
import {
  articleToMarkdown,
  contactToMarkdown,
  dossierToMarkdown,
  experienceToMarkdown,
  homeToMarkdown,
  projectToMarkdown,
  readingListingToMarkdown,
  speakingToMarkdown,
} from '../core/services/markdown-twin';

export const prerender = true;

/**
 * /llms-full.txt (V3b addendum commit 2) — every markdown twin concatenated into one document,
 * for agents that fetch a single URL rather than crawling the twin list in llms.txt. Same
 * redacted content-repository data every twin/HTML page reads; size stays sane because the
 * source content itself is already compression-disciplined (spec: copy compression rules).
 */
export const GET: APIRoute = async () => {
  const [
    articleEntries,
    projectEntries,
    positioning,
    roles,
    dossier,
    talks,
    hero,
    credibility,
    skillDomains,
    featuredProjects,
  ] = await Promise.all([
    getCollection('articles', ({ data }) => !data.draft),
    getCollection('projects'),
    contentRepository.getPositioning(),
    contentRepository.getRoles(),
    contentRepository.getDossier(),
    contentRepository.getTalks(),
    contentRepository.getHero(),
    contentRepository.getCredibility(),
    contentRepository.getSkillDomains(),
    contentRepository.getFeaturedProjects(),
  ]);

  const articles = await contentRepository.getArticles();
  const projects = await contentRepository.getProjects();
  const readings = await contentRepository.getReadings();

  const sections: string[] = [
    `# ${siteConfig.name} — full content\n\n> ${siteConfig.defaultDescription}\n`,
    homeToMarkdown(hero, positioning, credibility, skillDomains, featuredProjects),
    experienceToMarkdown(positioning, [...roles].reverse()),
    dossierToMarkdown(dossier, roles),
    speakingToMarkdown(talks),
    contactToMarkdown(siteConfig.contactEmail, siteConfig.bookingUrl),
    readingListingToMarkdown(readings),
    ...projectEntries.map((entry) => {
      const project = projects.find((p) => p.slug === entry.id)!;
      return projectToMarkdown(project, entry.body ?? '');
    }),
    ...articleEntries.map((entry) => {
      const article = articles.find((a) => a.slug === entry.id)!;
      return articleToMarkdown(article, entry.body ?? '');
    }),
    // PT-BR section removed — routes archived for v1 launch (ledger row 65).
    // Re-enable when _pt pages are restored.
  ];

  const body = sections.join('\n---\n\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
