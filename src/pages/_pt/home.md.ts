import type { APIRoute } from 'astro';
import { contentRepository } from '../../config/site';
import { homeToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/**
 * Markdown twin of /pt/ (V3d refinement addendum — closes the TODO in src/pages/llms.txt.ts and
 * docs/ai-ready.md). Served at /pt/home.md, mirroring the EN convention at /home.md (see
 * src/pages/home.md.ts for why "home" rather than "index"/"" is used). Same `homeToMarkdown`
 * function the EN twin calls, parameterized with the 'pt-br' locale.
 */
export const GET: APIRoute = async () => {
  const [hero, positioning, credibility, skillDomains, featuredProjects] = await Promise.all([
    contentRepository.getHero('pt-br'),
    contentRepository.getPositioning('pt-br'),
    contentRepository.getCredibility('pt-br'),
    contentRepository.getSkillDomains('pt-br'),
    contentRepository.getFeaturedProjects(),
  ]);

  const markdown = homeToMarkdown(hero, positioning, credibility, skillDomains, featuredProjects, 'pt-br');

  return new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
