import type { Article } from '../entities/article';
import type { Project } from '../entities/project';
import type { Role } from '../entities/role';
import type { Talk } from '../entities/talk';
import type { Testimonial } from '../entities/testimonial';
import type { SkillDomain } from '../entities/skill-domain';
import type { Reading } from '../entities/reading';
import type { SelfwrightMetricsSnapshot } from '../entities/selfwright-metrics';
import type { Locale } from '../../i18n';

export interface SiteSocialLink {
  label: string;
  url: string;
  icon: string;
}

export interface SitePositioning {
  statement: string;
}

export interface SiteHero {
  headline: string;
  slogan: string;
  subhead: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
}

export interface DossierCompetency {
  domain: string;
  /** 1 (aware) – 5 (deep/hands-on lead), sourced honestly from the skills matrix. */
  depth: number;
  evidence: string;
}

export interface DossierEducation {
  degree: string;
  school: string;
}

export interface DossierLanguage {
  name: string;
  level: string;
}

export interface Dossier {
  summary: string;
  competencyMatrix: DossierCompetency[];
  education: DossierEducation[];
  certifications: string[];
  languages: DossierLanguage[];
}

/** Home credibility strip (V3 addendum: content & metrics truth) — qualitative leadership
 *  statements, replacing headcount-shaped stat blocks. */
export interface SiteCredibility {
  statements: string[];
}

/** Visitor-intent chip (V3c commit 2) — a single quiet routing chip near the hero. */
export interface IntentChip {
  label: string;
  href: string;
}

/** One invitation card in the "Ways to work together" advisory/stewardship block (owner
 *  interview 2026-07-06). `topic` is one of the existing contact-form topics
 *  (src/core/services/contact-schema.ts) — the card's CTA pre-selects it on /contact. */
export interface WaysToWorkTogetherCard {
  title: string;
  body: string;
  topic: string;
}

/** "Ways to work together" section content (owner interview 2026-07-06): mentoring, advisory
 *  conversations, and speaking — the real, current invitations. Strictly anonymous by design;
 *  no employer/org names ever appear in this content. */
export interface WaysToWorkTogether {
  eyebrow: string;
  heading: string;
  subtitle?: string;
  cards: WaysToWorkTogetherCard[];
}

/** One executive-readable decision record on the /engineering proof-of-work hub — rewritten from
 *  this repo's own ADRs/specs/architecture doc, not raw ADR format. */
export interface EngineeringDecision {
  title: string;
  context: string;
  decision: string;
  cost: string;
}

/** One row of the "Why this stack" table/cards. */
export interface EngineeringStackItem {
  name: string;
  reason: string;
}

/** One dated changelog milestone, distilled from git log — no commit hashes. */
export interface EngineeringChangelogEntry {
  date: string;
  title: string;
  detail: string;
  /** Optional type-of-change accent slug: 'feature' | 'content' | 'infra' | 'fix'. */
  type?: string;
}

/** /engineering hub content: decisions, stack rationale, changelog. EN-only (see the
 *  `engineering` collection's comment in content.config.ts for why no PT sibling exists). */
export interface EngineeringHub {
  decisions: EngineeringDecision[];
  stack: EngineeringStackItem[];
  changelog: EngineeringChangelogEntry[];
}

/**
 * Port consumed by pages/components. Adapters (e.g. content-git) implement this
 * over whatever storage backs the content (Astro content collections today,
 * a hosted CMS later) without any page-level changes.
 */
export interface ContentRepository {
  getArticles(opts?: { includeDrafts?: boolean }): Promise<Article[]>;
  getArticle(slug: string): Promise<Article | undefined>;

  getProjects(): Promise<Project[]>;
  getProject(slug: string): Promise<Project | undefined>;
  getFeaturedProjects(): Promise<Project[]>;

  /**
   * `locale` (V3d addendum) defaults to 'en' so every pre-existing call site keeps working
   * unchanged. When 'pt-br', role narrative fields (`arc`, `impact[].narrative`) resolve from the
   * inline `arcPt`/`narrativePt` sibling fields on each role JSON, falling back to the EN value if
   * a given role's PT translation is still missing.
   */
  getRoles(locale?: Locale): Promise<Role[]>;

  getTalks(): Promise<Talk[]>;

  getTestimonials(): Promise<Testimonial[]>;

  /**
   * All published reading reviews, most recently read first. Uses `tolerantGlob` so a zero-entry
   * collection is valid and returns [] rather than throwing (same contract as talks/testimonials).
   */
  getReadings(): Promise<Reading[]>;

  /** `locale` (V3d addendum) selects between `content/site/site.json` (en) and
   *  `content/site/site.pt-br.json` (pt-br); defaults to 'en'. */
  getPositioning(locale?: Locale): Promise<SitePositioning>;
  getHero(locale?: Locale): Promise<SiteHero>;
  getSkillDomains(locale?: Locale): Promise<SkillDomain[]>;
  getSocialLinks(): Promise<SiteSocialLink[]>;
  getDossier(locale?: Locale): Promise<Dossier>;
  getCredibility(locale?: Locale): Promise<SiteCredibility>;
  getIntentChips(locale?: Locale): Promise<IntentChip[]>;
  getWaysToWorkTogether(locale?: Locale): Promise<WaysToWorkTogether>;

  /** /engineering hub content — EN-only, no `locale` param (see EngineeringHub doc comment). */
  getEngineeringHub(): Promise<EngineeringHub>;

  /**
   * Curated Selfwright eval-surface snapshot ("Measured, not claimed" panel on the /projects/
   * selfwright deep-dive), populated by `pnpm import-selfwright-metrics`. Returns `undefined` if
   * `content/metrics/selfwright.json` hasn't been generated yet — the panel renders nothing in
   * that case rather than erroring (owner runs the script manually; no CI coupling).
   */
  getSelfwrightMetrics(): Promise<SelfwrightMetricsSnapshot | undefined>;
}
