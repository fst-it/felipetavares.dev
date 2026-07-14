# ADR 0002: Single source of truth for content, config, and schemas

**Status:** Accepted · **Date:** 2026-07-06

## Context

The V5c architecture audit (`docs/architecture.md`) found the same handful
of small things defined twice in a codebase this size: a reading-time
formula, a date formatter, an SVG icon's coordinates, a contact email
literal. None of it was large. All of it was the same failure mode — two
copies drift the moment one gets edited and the other doesn't, and nobody
notices until the site says two different things in two different places.

## Decision

A piece of logic, a constant, a schema, or a content value is defined in
exactly one place. Every other place that needs it imports it. This
applies at every layer:

- **Content.** `content/` is the CMS. A page never invents a fact — it
  reads it from `ContentRepository`. The PT-BR site JSON is validated by
  the *same* zod schema as the EN file, not a forked copy (see `siteSchema`
  in `content.config.ts`). Role narratives get sibling fields (`arcPt`,
  `impact[].narrativePt`) on the *same* JSON file rather than a duplicate
  file per language, so `technologies`/`domains`/dates can't drift between
  an EN and PT copy of the same role.
- **Config.** Site-wide values — the domain, the contact email, the
  Cal.com link — live once in `src/config/site.ts`. A component that needs
  the contact email takes it as a prop from whatever `.astro` file already
  has `siteConfig` in scope; it does not hold its own string literal.
- **Schemas.** A repeated shape inside a zod schema (four identical
  `{summary, detail}` objects in the project `deepDive` field) becomes one
  named constant reused four times, not four inline literals that would
  need four synchronized edits if the shape ever changes.
- **Small formulas.** Reading time, date formatting, brand-mark SVG
  coordinates — each has exactly one implementation, in `src/lib/`,
  imported by every caller. Two call sites needing the same 12-line
  function is the signal to extract it, not a coincidence to ignore.

## What's a legitimate exception, not a violation

Single-source-of-truth is not "never repeat a line of code" — a few things
in this codebase look like duplication and aren't:

- **Different execution contexts that can't share an import.** `og-image.tsx`
  renders through satori, which can't resolve CSS custom properties — it
  hardcodes the same colors `tokens.css` defines, because the tool it runs
  through has no other option. `favicon.svg` is a static file browsers
  fetch directly; it can't import TypeScript. Both carry a comment pointing
  back to the canonical source so a future edit knows to update them by
  hand.
- **Build-time scripts outside the Astro runtime.** `scripts/build-chat-
  index.ts`, `scripts/build-blueprint-graph.ts`, and `scripts/publish-kit.ts`
  read `content/` off disk directly instead of through `ContentRepository`,
  because `astro:content` only resolves inside Astro's own build/dev
  pipeline — a standalone `tsx` process can't import it. That's a real
  constraint. What still has to be shared across those scripts is the
  *pure* helper logic built on top of that disk access (see
  `stripMdxComponents`, now imported from `src/core/services/
  markdown-twin.ts` by both scripts instead of copy-pasted).
- **Genuinely different behavior that happens to look similar.**
  `DetailSheet` (modal) and `InlineExpander` (inline) are two disclosure
  patterns for two different interaction shapes, not one component
  wearing two names. Forcing them into a shared abstraction would add a
  branching prop for a difference that's structural, not incidental.

## Consequences

- A change to a shared value or formula now has one place to make it and
  one place to test it.
- Reviewers checking new code ask "does this already exist somewhere?"
  before writing a new local implementation — `docs/architecture.md`'s
  findings table is the place to check.
- Where the exception list above no longer applies (a fourth caller shows
  up needing raw MDX body access, say), that's the signal to revisit the
  port itself rather than adding a fourth copy of the workaround.
