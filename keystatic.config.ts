import { config, fields, collection, singleton } from '@keystatic/core';

/**
 * Keystatic content-editing UI (spec sections 4 & 14). Mirrors the zod schemas in
 * src/content.config.ts field-for-field — Keystatic writes the same MDX/JSON files under
 * /content that Astro's content collections read, so there's exactly one content model.
 *
 * Storage is 'local' (dev-only, filesystem writes via the Keystatic UI at /keystatic) for now.
 * GitHub-mode storage (commits via PR/push using a GitHub App, so Felipe can publish from
 * anywhere without a local checkout) is documented as a TODO in docs/publishing.md — it needs a
 * GitHub App that doesn't exist yet.
 */
export default config({
  storage: { kind: 'local' },

  collections: {
    articles: collection({
      label: 'Articles',
      path: 'content/articles/*',
      format: { contentField: 'content' },
      slugField: 'title',
      columns: ['title', 'pubDate', 'draft'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        pubDate: fields.date({ label: 'Publish date' }),
        updatedDate: fields.date({ label: 'Updated date' }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value,
        }),
        heroImage: fields.text({ label: 'Hero image path' }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        canonicalOverride: fields.url({ label: 'Canonical override URL' }),
        syndication: fields.object({
          devto: fields.url({ label: 'Dev.to URL' }),
          hashnode: fields.url({ label: 'Hashnode URL' }),
          substack: fields.url({ label: 'Substack URL' }),
        }),
        series: fields.text({ label: 'Series' }),
        content: fields.mdx({ label: 'Body' }),
      },
    }),

    projects: collection({
      label: 'Projects',
      path: 'content/projects/*',
      format: { contentField: 'content' },
      slugField: 'title',
      columns: ['title', 'status', 'featured'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        tagline: fields.text({ label: 'Tagline' }),
        northStar: fields.text({ label: 'North star (mission — one strong line)', multiline: false }),
        problem: fields.text({ label: 'Problem it solves (1–2 sentences, executive language)', multiline: true }),
        outcomes: fields.array(fields.text({ label: 'Outcome' }), {
          label: 'Outcomes (2–3, executive language)',
          itemLabel: (props) => props.value,
        }),
        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived' },
            { label: 'Incubating', value: 'incubating' },
          ],
          defaultValue: 'active',
        }),
        roleLine: fields.text({ label: 'Role line' }),
        stack: fields.array(fields.text({ label: 'Technology' }), {
          label: 'Stack',
          itemLabel: (props) => props.value,
        }),
        repoUrl: fields.url({ label: 'Repository URL' }),
        liveUrl: fields.url({ label: 'Live URL' }),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
        heroImage: fields.text({ label: 'Hero image path' }),
        metrics: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            value: fields.text({ label: 'Value' }),
          }),
          { label: 'Metrics', itemLabel: (props) => props.fields.label.value }
        ),
        content: fields.mdx({ label: 'Body' }),
      },
    }),

    roles: collection({
      label: 'Roles',
      path: 'content/roles/*',
      slugField: 'title',
      columns: ['title', 'org', 'start'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        org: fields.text({ label: 'Organization' }),
        start: fields.text({ label: 'Start (YYYY-MM)' }),
        end: fields.text({ label: 'End (YYYY-MM)' }),
        location: fields.text({ label: 'Location' }),
        additionalLocation: fields.text({ label: 'Additional location (for dual-site roles, e.g. Siemens Lisbon + Munich)' }),
        arc: fields.text({ label: 'Arc / chapter title' }),
        impact: fields.array(
          fields.object({
            metric: fields.text({ label: 'Metric' }),
            narrative: fields.text({ label: 'Narrative', multiline: true }),
          }),
          { label: 'Impact', itemLabel: (props) => props.fields.metric.value }
        ),
        domains: fields.array(fields.text({ label: 'Domain' }), {
          label: 'Skill domains',
          itemLabel: (props) => props.value,
        }),
        logo: fields.text({ label: 'Logo path' }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
        techCategories: fields.array(
          fields.object({
            label: fields.text({ label: 'Category label' }),
            items: fields.array(fields.text({ label: 'Technology' }), {
              label: 'Technologies in this category',
              itemLabel: (props) => props.value,
            }),
          }),
          { label: 'Tech categories (categorized stack display — overrides flat technologies when present)', itemLabel: (props) => props.fields.label.value }
        ),
      },
    }),

    talks: collection({
      label: 'Talks',
      path: 'content/talks/*',
      slugField: 'title',
      columns: ['title', 'event', 'date', 'type'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        event: fields.text({ label: 'Event' }),
        date: fields.text({ label: 'Date (YYYY-MM-DD)' }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Talk', value: 'talk' },
            { label: 'Panel', value: 'panel' },
            { label: 'Paper', value: 'paper' },
            { label: 'Podcast', value: 'podcast' },
            { label: 'Press', value: 'press' },
          ],
          defaultValue: 'talk',
        }),
        url: fields.url({ label: 'URL' }),
        slidesUrl: fields.url({ label: 'Slides URL' }),
        abstract: fields.text({ label: 'Abstract', multiline: true }),
      },
    }),

    testimonials: collection({
      label: 'Testimonials',
      path: 'content/testimonials/*',
      slugField: 'author',
      columns: ['author', 'authorTitle'],
      schema: {
        author: fields.slug({ name: { label: 'Author' } }),
        quote: fields.text({ label: 'Quote', multiline: true }),
        authorTitle: fields.text({ label: "Author's title" }),
        relation: fields.text({ label: 'Relation' }),
      },
    }),

    // Mirrors the `reading` collection schema in src/content.config.ts field-for-field.
    reading: collection({
      label: 'Reading',
      path: 'content/reading/*',
      format: { contentField: 'content' },
      slugField: 'title',
      columns: ['title', 'author', 'type', 'verdict'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        author: fields.text({ label: 'Author' }),
        sourceUrl: fields.url({ label: 'Source URL' }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Book', value: 'book' },
            { label: 'Article', value: 'article' },
            { label: 'Paper', value: 'paper' },
          ],
          defaultValue: 'book',
        }),
        dateRead: fields.date({ label: 'Date read' }),
        verdict: fields.select({
          label: 'Verdict',
          options: [
            { label: 'Foundational', value: 'foundational' },
            { label: 'Worth your hours', value: 'worth-your-hours' },
            { label: 'Situational', value: 'situational' },
            { label: 'Skip unless…', value: 'skip-unless' },
          ],
          defaultValue: 'worth-your-hours',
        }),
        verdictLine: fields.text({ label: 'Verdict line (one sentence)', multiline: false }),
        ideasWorthStealing: fields.array(fields.text({ label: 'Idea' }), {
          label: 'Ideas worth stealing (2–4)',
          itemLabel: (props) => props.value,
        }),
        watchOuts: fields.array(fields.text({ label: 'Watch-out' }), {
          label: 'Watch-outs (1–3)',
          itemLabel: (props) => props.value,
        }),
        whoShouldRead: fields.text({ label: 'Who should read this (one sentence)', multiline: false }),
        domains: fields.array(fields.text({ label: 'Domain slug' }), {
          label: 'Skill domains',
          itemLabel: (props) => props.value,
        }),
        content: fields.mdx({ label: 'Essay body (optional)' }),
      },
    }),
  },

  singletons: {
    site: singleton({
      label: 'Site',
      path: 'content/site/site',
      schema: {
        site: fields.object({
          positioning: fields.object({
            statement: fields.text({ label: 'Positioning statement', multiline: true }),
          }),
          hero: fields.object({
            headline: fields.text({ label: 'Headline', multiline: true }),
            subhead: fields.text({ label: 'Subhead', multiline: true }),
            primaryCtaLabel: fields.text({ label: 'Primary CTA label' }),
            primaryCtaHref: fields.text({ label: 'Primary CTA href' }),
            secondaryCtaLabel: fields.text({ label: 'Secondary CTA label' }),
            secondaryCtaHref: fields.text({ label: 'Secondary CTA href' }),
          }),
          skillDomains: fields.array(
            fields.object({
              name: fields.text({ label: 'Name' }),
              shortLabel: fields.text({ label: 'Short label (≤16 chars, hero node)' }),
              blurb: fields.text({ label: 'Blurb', multiline: true }),
              weight: fields.integer({ label: 'Weight' }),
            }),
            { label: 'Skill domains', itemLabel: (props) => props.fields.name.value }
          ),
          /* Home credibility strip (V3 addendum: content & metrics truth) — mirrors
             SiteCredibility (src/core/ports/content-repository.ts). Pre-existing schema gap
             flagged by V3c, closed here (V3-polish commit 4). */
          credibility: fields.object({
            statements: fields.array(fields.text({ label: 'Statement' }), {
              label: 'Credibility statements',
              itemLabel: (props) => props.value,
            }),
          }),
          socialLinks: fields.array(
            fields.object({
              label: fields.text({ label: 'Label' }),
              url: fields.url({ label: 'URL' }),
              icon: fields.text({ label: 'Icon key' }),
            }),
            { label: 'Social links', itemLabel: (props) => props.fields.label.value }
          ),
          intentChips: fields.array(
            fields.object({
              label: fields.text({ label: 'Label' }),
              href: fields.text({ label: 'Href' }),
            }),
            { label: 'Intent chips', itemLabel: (props) => props.fields.label.value }
          ),
          /* "Ways to work together" advisory/stewardship block (owner interview 2026-07-06) —
             mirrors WaysToWorkTogether (src/core/ports/content-repository.ts). */
          waysToWorkTogether: fields.object({
            eyebrow: fields.text({ label: 'Eyebrow' }),
            heading: fields.text({ label: 'Heading' }),
            subtitle: fields.text({ label: 'Subtitle', multiline: true }),
            cards: fields.array(
              fields.object({
                title: fields.text({ label: 'Title' }),
                body: fields.text({ label: 'Body', multiline: true }),
                topic: fields.text({ label: 'Contact-form topic (must match an existing topic value)' }),
              }),
              { label: 'Cards', itemLabel: (props) => props.fields.title.value }
            ),
          }),
          dossier: fields.object({
            summary: fields.text({ label: 'Summary', multiline: true }),
            competencyMatrix: fields.array(
              fields.object({
                domain: fields.text({ label: 'Domain' }),
                depth: fields.integer({ label: 'Depth (1-5)' }),
                evidence: fields.text({ label: 'Evidence', multiline: true }),
              }),
              { label: 'Competency matrix', itemLabel: (props) => props.fields.domain.value }
            ),
            education: fields.array(
              fields.object({
                degree: fields.text({ label: 'Degree' }),
                school: fields.text({ label: 'School' }),
              }),
              { label: 'Education', itemLabel: (props) => props.fields.degree.value }
            ),
            certifications: fields.array(fields.text({ label: 'Certification' }), {
              label: 'Certifications',
              itemLabel: (props) => props.value,
            }),
            languages: fields.array(
              fields.object({
                name: fields.text({ label: 'Language' }),
                level: fields.text({ label: 'Level' }),
              }),
              { label: 'Languages', itemLabel: (props) => props.fields.name.value }
            ),
          }),
        }),
      },
    }),

    engineering: singleton({
      label: 'Engineering hub',
      path: 'content/engineering',
      schema: {
        engineering: fields.object({
          decisions: fields.array(
            fields.object({
              title: fields.text({ label: 'Title' }),
              context: fields.text({ label: 'Context', multiline: true }),
              decision: fields.text({ label: 'Decision', multiline: true }),
              cost: fields.text({ label: 'Cost / bought', multiline: true }),
            }),
            { label: 'Decisions', itemLabel: (props) => props.fields.title.value }
          ),
          stack: fields.array(
            fields.object({
              name: fields.text({ label: 'Name' }),
              reason: fields.text({ label: 'Reason', multiline: true }),
            }),
            { label: 'Stack', itemLabel: (props) => props.fields.name.value }
          ),
          changelog: fields.array(
            fields.object({
              date: fields.text({ label: 'Date (YYYY-MM-DD)' }),
              title: fields.text({ label: 'Title' }),
              detail: fields.text({ label: 'Detail', multiline: true }),
            }),
            { label: 'Changelog', itemLabel: (props) => props.fields.title.value }
          ),
        }),
      },
    }),
  },
});
