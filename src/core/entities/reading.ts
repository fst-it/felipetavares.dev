/**
 * Reading entity — books, articles, and papers reviewed by Felipe Tavares.
 * The verdict tiers are the owner's judgment: executive labels, not stars.
 * These are the single-definition source for the slug enum and the per-locale labels consumed by
 * both the Zod schema (src/content.config.ts) and the reading-page badge renderer.
 */

/** Slug enum for the four verdict tiers (best → worst). */
export const VERDICT_SLUGS = ['foundational', 'worth-your-hours', 'situational', 'skip-unless'] as const;
export type VerdictSlug = (typeof VERDICT_SLUGS)[number];

/** Owner-approved verdict labels per locale (docs/reading-workflow.md). */
export const VERDICT_LABELS: Record<VerdictSlug, { en: string; pt: string }> = {
  'foundational': { en: 'Foundational', pt: 'Fundamental' },
  'worth-your-hours': { en: 'Worth your hours', pt: 'Vale suas horas' },
  'situational': { en: 'Situational', pt: 'Situacional' },
  'skip-unless': { en: 'Skip unless…', pt: 'Pule, a menos que…' },
};

/** A published reading review. */
export interface Reading {
  slug: string;
  title: string;
  author: string;
  sourceUrl: string;
  type: 'book' | 'article' | 'paper';
  dateRead: Date;
  verdict: VerdictSlug;
  /** One-sentence owner verdict — the pull quote on the card. */
  verdictLine: string;
  /** 2–4 specific ideas worth taking from this work. */
  ideasWorthStealing: string[];
  /** 1–3 cautions or limitations the reader should know. */
  watchOuts: string[];
  /** Who gets the most value from reading this. */
  whoShouldRead: string;
  /** Skill-domain slugs this review touches (must match content/site/site.json skillDomains). */
  domains: string[];
}
