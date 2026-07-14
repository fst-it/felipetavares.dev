import { getCollection, getEntry } from 'astro:content';
import type {
  Article,
  Project,
  Role,
  Talk,
  Testimonial,
  Reading,
} from '../../core/entities';
import type {
  ContentRepository,
  SitePositioning,
  SiteHero,
  SiteSocialLink,
  Dossier,
  SiteCredibility,
  IntentChip,
  WaysToWorkTogether,
  EngineeringHub,
} from '../../core/ports/content-repository';
import type { SelfwrightMetricsSnapshot } from '../../core/entities/selfwright-metrics';
import type { SkillDomain } from '../../core/entities/skill-domain';
import type { Locale } from '../../i18n';
import { readingTimeFromWordCount } from '../../lib/reading-time';

/**
 * Implements ContentRepository over Astro content collections (git-backed
 * MDX/JSON files under /content). Swapping to a hosted CMS later means
 * writing a new adapter here — no page-level changes.
 */
export class GitContentRepository implements ContentRepository {
  async getArticles(opts?: { includeDrafts?: boolean }): Promise<Article[]> {
    const entries = await getCollection('articles', ({ data }) =>
      opts?.includeDrafts ? true : !data.draft
    );
    return entries
      .map((entry) => this.toArticle(entry))
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  }

  async getArticle(slug: string): Promise<Article | undefined> {
    const entry = await getEntry('articles', slug);
    return entry ? this.toArticle(entry) : undefined;
  }

  async getProjects(): Promise<Project[]> {
    const entries = await getCollection('projects');
    return entries.map((entry) => this.toProject(entry)).sort((a, b) => a.order - b.order);
  }

  async getProject(slug: string): Promise<Project | undefined> {
    const entry = await getEntry('projects', slug);
    return entry ? this.toProject(entry) : undefined;
  }

  async getFeaturedProjects(): Promise<Project[]> {
    const projects = await this.getProjects();
    return projects.filter((p) => p.featured);
  }

  async getRoles(locale: Locale = 'en'): Promise<Role[]> {
    const entries = await getCollection('roles');
    return entries
      .map((entry) => {
        const { arcPt, impact, ...rest } = entry.data;
        return {
          slug: entry.id,
          ...rest,
          arc: locale === 'pt-br' && arcPt ? arcPt : entry.data.arc,
          impact: impact.map((item) => ({
            metric: item.metric,
            narrative: locale === 'pt-br' && item.narrativePt ? item.narrativePt : item.narrative,
          })),
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  async getTalks(): Promise<Talk[]> {
    // Astro's glob loader throws "does not exist or is empty" for a zero-match collection
    // (rather than returning []) — both talks and testimonials are legitimately unseeded so
    // far; the pages that consume these already render a "coming soon" empty state.
    const entries = await getCollection('talks').catch(() => []);
    return entries
      .map((entry) => ({ slug: entry.id, ...entry.data }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getTestimonials(): Promise<Testimonial[]> {
    const entries = await getCollection('testimonials').catch(() => []);
    return entries.map((entry) => ({ slug: entry.id, ...entry.data }));
  }

  async getReadings(): Promise<Reading[]> {
    const entries = await getCollection('reading').catch(() => []);
    return entries
      .map((entry) => ({
        slug: entry.id,
        ...entry.data,
      }))
      .sort((a, b) => b.dateRead.getTime() - a.dateRead.getTime());
  }

  async getPositioning(locale: Locale = 'en'): Promise<SitePositioning> {
    const site = await this.getSite(locale);
    return site.positioning;
  }

  async getHero(locale: Locale = 'en'): Promise<SiteHero> {
    const site = await this.getSite(locale);
    return site.hero;
  }

  async getSkillDomains(locale: Locale = 'en'): Promise<SkillDomain[]> {
    const site = await this.getSite(locale);
    return [...site.skillDomains].sort((a, b) => b.weight - a.weight);
  }

  async getSocialLinks(): Promise<SiteSocialLink[]> {
    // Social links aren't user-facing copy (labels are proper nouns/brand names) — always the EN
    // singleton regardless of locale.
    const site = await this.getSite('en');
    return site.socialLinks;
  }

  async getDossier(locale: Locale = 'en'): Promise<Dossier> {
    const site = await this.getSite(locale);
    return site.dossier;
  }

  async getCredibility(locale: Locale = 'en'): Promise<SiteCredibility> {
    const site = await this.getSite(locale);
    return site.credibility;
  }

  async getIntentChips(locale: Locale = 'en'): Promise<IntentChip[]> {
    const site = await this.getSite(locale);
    return site.intentChips;
  }

  async getWaysToWorkTogether(locale: Locale = 'en'): Promise<WaysToWorkTogether> {
    const site = await this.getSite(locale);
    return site.waysToWorkTogether;
  }

  async getEngineeringHub(): Promise<EngineeringHub> {
    const entry = await getEntry('engineering', 'engineering');
    if (!entry) {
      throw new Error('content/engineering.json is missing the "engineering" singleton entry.');
    }
    return entry.data;
  }

  async getSelfwrightMetrics(): Promise<SelfwrightMetricsSnapshot | undefined> {
    const entry = await getEntry('metrics', 'selfwright');
    return entry?.data;
  }

  /** Resolves the site singleton for a locale (V3d addendum): 'en' reads the `site` collection
   *  (content/site/site.json), 'pt-br' reads the `siteBrPt` collection
   *  (content/site/site.pt-br.json) — same schema, sibling files, no fallback merge (the PT file
   *  is expected to be a complete translation, not a partial overlay). */
  private async getSite(locale: Locale) {
    if (locale === 'pt-br') {
      const entry = await getEntry('siteBrPt', 'site');
      if (!entry) {
        throw new Error('content/site/site.pt-br.json is missing the "site" singleton entry.');
      }
      return entry.data;
    }
    const entry = await getEntry('site', 'site');
    if (!entry) {
      throw new Error('content/site/site.json is missing the "site" singleton entry.');
    }
    return entry.data;
  }

  private toArticle(entry: {
    id: string;
    data: {
      title: string;
      description: string;
      pubDate: Date;
      updatedDate?: Date;
      tags: string[];
      heroImage?: string;
      draft: boolean;
      canonicalOverride?: string;
      syndication?: { devto?: string; hashnode?: string; substack?: string };
      series?: string;
    };
    body?: string;
  }): Article {
    const wordCount = entry.body ? entry.body.trim().split(/\s+/).length : 0;
    return {
      slug: entry.id,
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.pubDate,
      updatedDate: entry.data.updatedDate,
      tags: entry.data.tags,
      heroImage: entry.data.heroImage,
      draft: entry.data.draft,
      canonicalOverride: entry.data.canonicalOverride,
      syndication: entry.data.syndication,
      readingTime: readingTimeFromWordCount(wordCount),
      series: entry.data.series,
    };
  }

  private toProject(entry: {
    id: string;
    data: {
      title: string;
      tagline: string;
      northStar: string;
      problem: string;
      outcomes: string[];
      status: 'active' | 'archived' | 'incubating';
      roleLine: string;
      stack: string[];
      repoUrl?: string;
      liveUrl?: string;
      featured: boolean;
      order: number;
      heroImage?: string;
      metrics: { label: string; value: string }[];
      deepDive?: Project['deepDive'];
    };
  }): Project {
    return {
      slug: entry.id,
      ...entry.data,
    };
  }
}
