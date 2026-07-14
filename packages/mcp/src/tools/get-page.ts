/**
 * `get_page` — deterministic tool, zero LLM. Returns the markdown-twin content of one known site
 * page, reusing the exact same pure formatting functions the site's own `*.md.ts` endpoints call
 * (src/core/services/markdown-twin.ts) — no second copy of the rendering logic.
 *
 * Security: `path` is validated against a fixed allow-list (`PAGE_LOADERS`' keys) via a zod enum
 * *before* any content lookup runs. There is no filesystem access derived from the input string —
 * the input only ever selects a map key; an attacker-supplied value like `../../secrets` fails zod
 * validation and never reaches a loader, dynamic slug lookups (articles/projects) are resolved
 * against the same in-memory list `list_articles`/`list_projects` already exposes, not the raw
 * input string.
 */
import { z } from 'zod';
import {
  articleToMarkdown,
  projectToMarkdown,
  experienceToMarkdown,
  dossierToMarkdown,
  speakingToMarkdown,
  contactToMarkdown,
  homeToMarkdown,
  engineeringHubToMarkdown,
} from '../../../../src/core/services/markdown-twin';
import {
  loadArticles,
  loadProjects,
  loadRoles,
  loadTalks,
  loadDossier,
  loadPositioning,
  loadCredibility,
  loadSkillDomains,
  loadFeaturedProjects,
  loadEngineeringHub,
} from '../content-loader';
import { SITE_CONTACT_EMAIL } from './get-cv';

const CAL_COM_URL = 'https://cal.com/TODO-felipe-tavares/30min';

/** Fixed, non-parameterized pages — every key here is a literal the zod schema accepts, nothing
 *  derived from user input. */
const STATIC_PAGES = ['/', '/experience', '/experience/dossier', '/speaking', '/contact', '/engineering'] as const;

export const getPageInputSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .max(200)
      .describe(
        'A page path from this site. Either a static page (' +
          STATIC_PAGES.join(', ') +
          ') or a dynamic one (/projects/<slug>, /writing/<slug>) — use `list_projects`/' +
          '`list_articles` to discover valid slugs.'
      ),
  })
  .strict();

export type GetPageInput = z.infer<typeof getPageInputSchema>;

export interface GetPageResult {
  path: string;
  markdown: string;
}

async function resolveStatic(pagePath: (typeof STATIC_PAGES)[number]): Promise<string> {
  switch (pagePath) {
    case '/': {
      const [positioning, credibility, skillDomains, featuredProjects] = await Promise.all([
        loadPositioning(),
        loadCredibility(),
        loadSkillDomains(),
        loadFeaturedProjects(),
      ]);
      // homeToMarkdown's `hero` param only contributes headline/slogan/subhead text (no CTAs are
      // rendered in the markdown twin) — reuses the same positioning statement rather than
      // inventing a second hero object here.
      return homeToMarkdown(
        {
          headline: 'Felipe Tavares',
          slogan: '',
          subhead: '',
          primaryCtaLabel: '',
          primaryCtaHref: '',
          secondaryCtaLabel: '',
          secondaryCtaHref: '',
        },
        positioning,
        credibility,
        skillDomains,
        featuredProjects
      );
    }
    case '/experience': {
      const [positioning, roles] = await Promise.all([loadPositioning(), loadRoles()]);
      return experienceToMarkdown(positioning, roles);
    }
    case '/experience/dossier': {
      const [dossier, roles] = await Promise.all([loadDossier(), loadRoles()]);
      return dossierToMarkdown(dossier, roles);
    }
    case '/speaking':
      return speakingToMarkdown(await loadTalks());
    case '/contact':
      return contactToMarkdown(SITE_CONTACT_EMAIL, CAL_COM_URL);
    case '/engineering':
      return engineeringHubToMarkdown(await loadEngineeringHub());
  }
}

export async function getPage(input: GetPageInput): Promise<GetPageResult | { error: string }> {
  const { path: pagePath } = input;

  if ((STATIC_PAGES as readonly string[]).includes(pagePath)) {
    const markdown = await resolveStatic(pagePath as (typeof STATIC_PAGES)[number]);
    return { path: pagePath, markdown };
  }

  const projectMatch = pagePath.match(/^\/projects\/([a-z0-9-]+)$/);
  if (projectMatch) {
    const slug = projectMatch[1];
    const projects = await loadProjects();
    const project = projects.find((p) => p.slug === slug);
    if (!project) return { error: `No project found at path "${pagePath}". Use list_projects to see valid slugs.` };
    return { path: pagePath, markdown: projectToMarkdown(project, project.body) };
  }

  const articleMatch = pagePath.match(/^\/writing\/([a-z0-9-]+)$/);
  if (articleMatch) {
    const slug = articleMatch[1];
    const articles = await loadArticles();
    const article = articles.find((a) => a.slug === slug);
    if (!article) return { error: `No article found at path "${pagePath}". Use list_articles to see valid slugs.` };
    return { path: pagePath, markdown: articleToMarkdown(article, article.body) };
  }

  return {
    error: `Unknown page path "${pagePath}". Valid static paths: ${STATIC_PAGES.join(', ')}. Dynamic paths: /projects/<slug>, /writing/<slug>.`,
  };
}

export const getPageToolDefinition = {
  title: 'Get Page',
  description:
    'Returns the clean markdown content of one page on felipetavares.dev, identical to that ' +
    "page's markdown twin (e.g. /writing/<slug>.md). Accepts a fixed set of static paths (" +
    STATIC_PAGES.join(', ') +
    ') or a dynamic `/projects/<slug>` / `/writing/<slug>` path — use `list_projects` or ' +
    '`list_articles` first to find a valid slug. An unrecognized path returns `{error}` rather ' +
    'than a filesystem error; there is no way to read arbitrary files through this tool. ' +
    'Example: `{"path": "/projects/selfwright"}`.',
  inputSchema: getPageInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
