/**
 * Content loader — reads the committed content snapshot (src/generated/content-snapshot.json,
 * built by scripts/build-content-snapshot.ts), never the filesystem directly.
 *
 * History: this originally read content/ off disk via node:fs at request time, which works for
 * the stdio transport (a real Node process) but not the Cloudflare Worker transport (commit 3) —
 * Workers have no filesystem. Rather than keep two separate content-reading implementations (one
 * per transport, an ADR-0002 violation waiting to happen), both now read the same static snapshot,
 * exactly the pattern src/generated/chat-chunks.json already established for search. Run
 * `pnpm --filter felipetavares-mcp build-content-snapshot` whenever content/ changes.
 *
 * Reads English content only — the MCP surface, like `/api/cv.json` and `llms.txt`, serves the
 * site's canonical single-language content; it does not mirror the PT-BR locale fields.
 */
import snapshot from './generated/content-snapshot.json' with { type: 'json' };
import type { Article } from '../../../src/core/entities/article';
import type { Project } from '../../../src/core/entities/project';
import type { Role } from '../../../src/core/entities/role';
import type { Talk } from '../../../src/core/entities/talk';
import type { SkillDomain } from '../../../src/core/entities/skill-domain';
import type {
  SitePositioning,
  SiteSocialLink,
  SiteCredibility,
  Dossier,
  EngineeringHub,
} from '../../../src/core/ports/content-repository';

function readingTimeFromWordCount(words: number): string {
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export interface LoadedArticle extends Article {
  /** Raw MDX body (frontmatter stripped, MDX component tags not yet stripped). */
  body: string;
}

export interface LoadedProject extends Project {
  body: string;
}

interface SnapshotArticle {
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

interface SnapshotProject {
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Published (non-draft) articles, most recent first — mirrors GitContentRepository.getArticles(). */
export async function loadArticles(): Promise<LoadedArticle[]> {
  const articles = (snapshot.articles as SnapshotArticle[])
    .filter((a) => !a.frontmatter.draft)
    .map((a): LoadedArticle => {
      const fm = a.frontmatter as {
        title: string;
        description: string;
        pubDate: string;
        updatedDate?: string;
        tags?: string[];
        heroImage?: string;
        canonicalOverride?: string;
        syndication?: Article['syndication'];
        series?: string;
      };
      const wordCount = a.body.trim().split(/\s+/).filter(Boolean).length;
      return {
        slug: a.slug,
        title: fm.title,
        description: fm.description,
        pubDate: new Date(fm.pubDate),
        updatedDate: fm.updatedDate ? new Date(fm.updatedDate) : undefined,
        tags: fm.tags ?? [],
        heroImage: fm.heroImage,
        draft: false,
        canonicalOverride: fm.canonicalOverride,
        syndication: fm.syndication,
        readingTime: readingTimeFromWordCount(wordCount),
        series: fm.series,
        body: a.body,
      };
    });

  return articles.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export async function loadArticle(slug: string): Promise<LoadedArticle | undefined> {
  const articles = await loadArticles();
  return articles.find((a) => a.slug === slug);
}

/** All projects (including non-featured), ordered per `order` — mirrors GitContentRepository.getProjects(). */
export async function loadProjects(): Promise<LoadedProject[]> {
  const projects = (snapshot.projects as SnapshotProject[]).map((p): LoadedProject => {
    const fm = p.frontmatter as {
      title: string;
      tagline: string;
      northStar: string;
      problem: string;
      outcomes: string[];
      status: Project['status'];
      roleLine: string;
      stack?: string[];
      repoUrl?: string;
      liveUrl?: string;
      featured?: boolean;
      order?: number;
      heroImage?: string;
      metrics?: Project['metrics'];
      deepDive?: Project['deepDive'];
    };
    return {
      slug: p.slug,
      title: fm.title,
      tagline: fm.tagline,
      northStar: fm.northStar,
      problem: fm.problem,
      outcomes: fm.outcomes ?? [],
      status: fm.status,
      roleLine: fm.roleLine,
      stack: fm.stack ?? [],
      repoUrl: fm.repoUrl,
      liveUrl: fm.liveUrl,
      featured: Boolean(fm.featured),
      order: fm.order ?? 0,
      heroImage: fm.heroImage,
      metrics: fm.metrics ?? [],
      deepDive: fm.deepDive,
      body: p.body,
    };
  });

  return projects.sort((a, b) => a.order - b.order);
}

export async function loadProject(slug: string): Promise<LoadedProject | undefined> {
  const projects = await loadProjects();
  return projects.find((p) => p.slug === slug);
}

export async function loadRoles(): Promise<Role[]> {
  const roles = (snapshot.roles as (Role & { impact?: Role['impact'] })[]).map(
    (data): Role => ({
      slug: data.slug,
      org: data.org,
      title: data.title,
      start: data.start,
      end: data.end,
      location: data.location,
      arc: data.arc,
      impact: (data.impact ?? []).map((i) => ({ metric: i.metric, narrative: i.narrative })),
      domains: data.domains ?? [],
      logo: data.logo,
      order: data.order ?? 0,
      technologies: data.technologies ?? [],
    })
  );

  return roles.sort((a, b) => a.order - b.order);
}

/** Talks/press collection is legitimately unseeded so far (matches GitContentRepository.getTalks(),
 *  which also tolerates a zero-entry collection) — returns []. */
export async function loadTalks(): Promise<Talk[]> {
  const talks = snapshot.talks as Talk[];
  return [...talks].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function loadPositioning(): Promise<SitePositioning> {
  return snapshot.site.positioning;
}

export async function loadSkillDomains(): Promise<SkillDomain[]> {
  return [...(snapshot.site.skillDomains as SkillDomain[])].sort((a, b) => b.weight - a.weight);
}

export async function loadSocialLinks(): Promise<SiteSocialLink[]> {
  return snapshot.site.socialLinks;
}

export async function loadDossier(): Promise<Dossier> {
  return snapshot.site.dossier;
}

export async function loadCredibility(): Promise<SiteCredibility> {
  return snapshot.site.credibility;
}

export async function loadFeaturedProjects(): Promise<LoadedProject[]> {
  const projects = await loadProjects();
  return projects.filter((p) => p.featured);
}

/** /engineering hub content — available for a future `get_page` static route (not wired into
 *  its allow-list yet; see the /engineering stage's commit for why). */
export async function loadEngineeringHub(): Promise<EngineeringHub> {
  return snapshot.engineering as EngineeringHub;
}
