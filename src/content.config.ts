import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';
import { VERDICT_SLUGS } from './core/entities/reading';
import siteData from '../content/site/site.json';

/** Derives the 12 skill-domain slugs from the site singleton (single source of truth:
 *  content/site/site.json `skillDomains[].name`). Used by the `reading` collection's `domains`
 *  field to validate at build time that every domain tag matches a real domain. */
const SKILL_DOMAIN_SLUGS: string[] = siteData.site.skillDomains.map((d: { name: string }) =>
  d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
);

/**
 * Wraps `glob()` to silence its two "nothing to load" warnings for collections that are
 * legitimately unseeded so far (talks, testimonials) — both `getTalks()`/`getTestimonials()`
 * already handle a zero-entry collection with a `.catch(() => [])` and the pages render their own
 * "coming soon" empty state either way (V3 addendum: dev-server noise cleanup — "WITHOUT changing
 * empty-state page behavior"). `glob()`'s own warnings ("base directory does not exist" / "no
 * files found matching pattern") are hardcoded into Astro core with no suppression option, so this
 * proxies just the `logger.warn` calls matching those two known-harmless messages through to a
 * no-op, and passes every other logger call (and all other behavior) straight through unchanged.
 */
function tolerantGlob(options: Parameters<typeof glob>[0]): Loader {
  const inner = glob(options);
  return {
    ...inner,
    load: (context: LoaderContext) => {
      // Proxy (not a spread/clone) so every other method (`fork`, `info`, `error`, `debug`) and
      // any internal state stays bound to the real logger instance — only `warn` is intercepted.
      const logger = new Proxy(context.logger, {
        get(target, prop, receiver) {
          if (prop === 'warn') {
            return (message: string) => {
              if (message.startsWith('The base directory') || message.startsWith('No files found matching')) {
                return;
              }
              target.warn(message);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
      return inner.load({ ...context, logger });
    },
  };
}

const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    canonicalOverride: z.string().url().optional(),
    syndication: z
      .object({
        devto: z.string().url().optional(),
        hashnode: z.string().url().optional(),
        substack: z.string().url().optional(),
      })
      .optional(),
    series: z.string().optional(),
  }),
});

// Shared shape for each deepDive card below (summary always-visible line + DetailSheet body).
const summaryDetailSchema = z.object({ summary: z.string(), detail: z.string() });

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/projects' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    // Value-led card fields (H: /projects redesign). Required so cards never render half-empty;
    // both existing projects can populate them fully.
    northStar: z.string(),
    problem: z.string(),
    outcomes: z.array(z.string()).min(2).max(3),
    status: z.enum(['active', 'archived', 'incubating']),
    roleLine: z.string(),
    stack: z.array(z.string()).default([]),
    repoUrl: z.string().url().optional(),
    liveUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    heroImage: z.string().optional(),
    metrics: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .default([]),
    // Problem -> Approach -> Architecture -> Results card row (V3b addendum commit 1). Optional
    // so existing/future project MDX without a deep-dive summary still validates; each card reuses
    // `summaryDetailSchema` above (`summary` is the always-visible line, `detail` is the
    // DetailSheet body — longer, may reuse wording already in the MDX body below — no new facts
    // invented here).
    deepDive: z
      .object({
        problem: summaryDetailSchema,
        approach: summaryDetailSchema,
        architecture: summaryDetailSchema,
        results: summaryDetailSchema,
      })
      .optional(),
  }),
});

const roles = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './content/roles' }),
  schema: z.object({
    org: z.string(),
    title: z.string(),
    start: z.string(),
    end: z.string().optional(),
    location: z.string(),
    // Optional second location for roles spanning two sites (e.g. Siemens: Lisbon + Munich).
    // Rendered alongside the primary location and flag in summary cards, detailed chapters, and
    // the dossier. Kept as a sibling string rather than an array — no role has more than two.
    additionalLocation: z.string().optional(),
    arc: z.string(),
    // PT-BR narrative sibling field (V3d addendum). Inline on the same role file rather than a
    // separate 7-file PT collection — keeps `technologies`/`domains`/dates as one source of truth
    // per role, avoiding drift between an EN and PT copy of the non-narrative fields. Optional so
    // it can land role-by-role; RoleChapter.astro falls back to `arc` if absent (should never
    // happen once translation is complete, but keeps the page from breaking on a partial pass).
    arcPt: z.string().optional(),
    impact: z
      .array(
        z.object({
          metric: z.string(),
          narrative: z.string(),
          // See `arcPt` above — same inline-sibling-field rationale.
          narrativePt: z.string().optional(),
        })
      )
      .default([]),
    domains: z.array(z.string()).default([]),
    logo: z.string().optional(),
    order: z.number().default(0),
    // Tech-stack expander chips (V3 addendum: journey tech expanders). Sourced only from
    // the private source-of-truth notes; omitted on roles where the truth layer doesn't name a
    // specific stack (e.g. product-management-only roles).
    technologies: z.array(z.string()).default([]),
    // Categorized tech display for roles with large, multi-domain stacks. When present, the
    // "Tech stack" expander renders grouped headings instead of a flat chip list. Optional so
    // existing roles with flat `technologies` keep working without change.
    techCategories: z
      .array(
        z.object({
          label: z.string(),
          items: z.array(z.string()),
        })
      )
      .optional(),
  }),
});

const talks = defineCollection({
  loader: tolerantGlob({ pattern: '**/*.json', base: './content/talks' }),
  schema: z.object({
    title: z.string(),
    event: z.string(),
    date: z.string(),
    type: z.enum(['talk', 'panel', 'paper', 'podcast', 'press']),
    url: z.string().url().optional(),
    slidesUrl: z.string().url().optional(),
    abstract: z.string(),
  }),
});

const testimonials = defineCollection({
  loader: tolerantGlob({ pattern: '**/*.json', base: './content/testimonials' }),
  schema: z.object({
    quote: z.string(),
    author: z.string(),
    authorTitle: z.string(),
    relation: z.string(),
  }),
});

// Site singleton schema — shared verbatim by the EN and PT-BR files below (V3d addendum: the
// PT-BR site content is a sibling file validated by the exact same schema, not a schema fork).
const siteSchema = z.object({
  positioning: z.object({
    statement: z.string(),
  }),
  hero: z.object({
    headline: z.string(),
    // Primary slogan (addendum section 2). Alternate considered: "Enterprise vision,
    // engineered." — kept here only as a comment; swap by editing content/site/site.json.
    slogan: z.string(),
    subhead: z.string(),
    primaryCtaLabel: z.string(),
    primaryCtaHref: z.string(),
    secondaryCtaLabel: z.string(),
    secondaryCtaHref: z.string(),
  }),
  skillDomains: z.array(
    z.object({
      name: z.string(),
      // Short display label for the hero constellation node (≤~16 chars). Falls back to `name`
      // if absent so existing content validates during a partial migration. Added in the
      // short-label overlap-fix pass (V3-polish: hero label overlaps).
      shortLabel: z.string().optional(),
      blurb: z.string(),
      weight: z.number(),
    })
  ),
  // Home credibility strip (V3 addendum: content & metrics truth) — qualitative leadership
  // statements in Felipe's own phrasing, replacing headcount-shaped stat blocks.
  credibility: z.object({
    statements: z.array(z.string()),
  }),
  // Visitor-intent chip strip (V3c commit 2) — quiet, secondary routing near the hero for the
  // three visitor archetypes (hiring executive / technical reviewer / event organizer).
  intentChips: z.array(
    z.object({
      label: z.string(),
      href: z.string(),
    })
  ),
  // "Ways to work together" advisory/stewardship block (owner interview 2026-07-06): mentoring,
  // advisory conversations, and speaking — the real, current invitations. Strictly anonymous
  // (never names an employer or org); each card's `topic` matches an existing contact-form topic
  // (src/core/services/contact-schema.ts) so its CTA can pre-select it on /contact.
  waysToWorkTogether: z.object({
    eyebrow: z.string(),
    heading: z.string(),
    subtitle: z.string().optional(),
    cards: z.array(
      z.object({
        title: z.string(),
        body: z.string(),
        topic: z.string(),
      })
    ),
  }),
  socialLinks: z.array(
    z.object({
      label: z.string(),
      url: z.string().url(),
      icon: z.string(),
    })
  ),
  dossier: z.object({
    summary: z.string(),
    competencyMatrix: z.array(
      z.object({
        domain: z.string(),
        depth: z.number().min(1).max(5),
        evidence: z.string(),
      })
    ),
    education: z.array(
      z.object({
        degree: z.string(),
        school: z.string(),
      })
    ),
    certifications: z.array(z.string()),
    languages: z.array(
      z.object({
        name: z.string(),
        level: z.string(),
      })
    ),
  }),
});

// Site singletons: positioning statement, hero copy, skill domains, social links.
const site = defineCollection({
  loader: file('./content/site/site.json'),
  schema: siteSchema,
});

// PT-BR sibling (V3d addendum: i18n) — same schema, same shape, translated values. Keystatic
// editing stays EN-only in v1 (its singleton config still points at site.json); this file is
// hand/AI-drafted and reviewed directly rather than through the Keystatic UI.
const siteBrPt = defineCollection({
  loader: file('./content/site/site.pt-br.json'),
  schema: siteSchema,
});

// Engineering hub singleton (/engineering) — proof-of-work page distilling real decision records,
// stack rationale, and a changelog from this repo's own ADRs, specs, and git history. EN-only,
// same rationale as article/project deep-dives staying unprefixed (V3d addendum's documented v1
// scope): this is a single curated page, not a per-locale content type.
const engineering = defineCollection({
  loader: file('./content/engineering.json'),
  schema: z.object({
    decisions: z.array(
      z.object({
        title: z.string(),
        context: z.string(),
        decision: z.string(),
        cost: z.string(),
      })
    ),
    stack: z.array(
      z.object({
        name: z.string(),
        reason: z.string(),
      })
    ),
    changelog: z.array(
      z.object({
        date: z.string(),
        title: z.string(),
        detail: z.string(),
        type: z.string().optional(),
      })
    ),
  }),
});

// Curated eval/metrics snapshots (build stage: "Selfwright eval surface") — populated by
// `pnpm import-selfwright-metrics`, never hand-authored. `tolerantGlob` (not `file()`) so a
// missing snapshot is a zero-entry collection, not a build failure — the "Measured, not claimed"
// panel on /projects/selfwright renders nothing when this collection is empty, same graceful-
// absence contract as talks/testimonials.
//
// Shape mirrors `selfwrightMetricsSnapshotSchema` in `core/services/selfwright-metrics-curation.ts`
// (the schema the import script and its unit tests validate against) — not re-imported directly
// because Astro's content-collection `z` is a distinct branded zod instance from the bare `zod`
// package that file uses (same documented exception as og-image.tsx's satori constraint in
// docs/adr/0002-single-source-of-truth.md: a real cross-runtime type-system limit, not a choice).
// If the two shapes ever diverge, update both — this repo has no automated cross-check for it,
// same as the two other documented satori/favicon exceptions.
const metrics = defineCollection({
  // `selfwright-manifest.json` is excluded: it's the committed fallback for the build-time
  // Selfwright metrics loader (src/lib/selfwright-metrics.ts), a different flat shape read via
  // plain `fs`, not a curated snapshot — including it here would fail this collection's schema.
  loader: tolerantGlob({ pattern: ['**/*.json', '!selfwright-manifest.json'], base: './content/metrics' }),
  schema: z.object({
    capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'capturedAt must be an ISO YYYY-MM-DD date'),
    groups: z.array(
      z.object({
        title: z.string().min(1),
        metrics: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1),
        source: z.string().min(1),
      })
    ),
  }),
});

// Reading reviews — books, articles, and papers reviewed by Felipe Tavares. Uses `tolerantGlob`
// so a zero-entry collection is valid (same pattern as talks/testimonials). The `domains` field
// validates against the 12 skill-domain slugs derived from content/site/site.json at build time.
// MDX body (optional) holds the longer essay; the structured review fields above are always
// present and always visible on the card.
const reading = defineCollection({
  loader: tolerantGlob({ pattern: '**/*.mdx', base: './content/reading' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    sourceUrl: z.string().url(),
    type: z.enum(['book', 'article', 'paper']),
    dateRead: z.coerce.date(),
    verdict: z.enum(VERDICT_SLUGS),
    /** One-sentence pull quote for the card — the owner's bottom-line judgment. */
    verdictLine: z.string(),
    /** 2–4 specific ideas the reader should steal from this work. */
    ideasWorthStealing: z.array(z.string()).min(2).max(4),
    /** 1–3 cautions or limitations worth knowing before/after reading. */
    watchOuts: z.array(z.string()).min(1).max(3),
    /** Who gets the most from this work (one crisp sentence). */
    whoShouldRead: z.string(),
    /** Skill-domain slugs this review covers. Must match content/site/site.json skillDomains. */
    domains: z
      .array(z.string())
      .default([])
      .refine(
        (vals) => vals.every((v) => SKILL_DOMAIN_SLUGS.includes(v)),
        {
          message: `Each domain must be one of the 12 skill-domain slugs: ${SKILL_DOMAIN_SLUGS.join(', ')}`,
        }
      ),
  }),
});

export const collections = { articles, projects, roles, talks, testimonials, site, siteBrPt, engineering, metrics, reading };
