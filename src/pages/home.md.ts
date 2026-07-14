import type { APIRoute } from 'astro';
import { contentRepository } from '../config/site';
import { homeToMarkdown } from '../core/services/markdown-twin';

export const prerender = true;

/**
 * Markdown twin of / (V3b addendum commit 2). Served at /home.md rather than /index.md or /.md —
 * Astro's file-based routing maps a root `index.*` file to `/`, and an endpoint literally named
 * `index.md.ts` would collide with that same `/` route slot in a way that reads confusingly next
 * to the site's actual homepage; `/home.md` is the unambiguous, conventional choice used by sites
 * with a similar twin pattern (mirrors GitHub's own `/<owner>/<repo>` -> README convention of a
 * plain, guessable name).
 */
export const GET: APIRoute = async () => {
  const [hero, positioning, credibility, skillDomains, featuredProjects] = await Promise.all([
    contentRepository.getHero(),
    contentRepository.getPositioning(),
    contentRepository.getCredibility(),
    contentRepository.getSkillDomains(),
    contentRepository.getFeaturedProjects(),
  ]);

  const markdown = homeToMarkdown(hero, positioning, credibility, skillDomains, featuredProjects);

  return new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
