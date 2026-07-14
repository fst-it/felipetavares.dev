# Architecture

felipetavares.dev is a hexagonal, composable system: pure domain logic in the
center, adapters at the edges, framework code kept as far out as it'll go.
This document maps the layers, states the rules that keep them from
collapsing into each other, and records what the V5c audit found duplicated
across the codebase — with what happened to each finding.

## 1. The layer map

```
core (pure TypeScript)
  entities/    Article, Project, Role, Talk, SkillDomain, ChatMessage...
  ports/       ContentRepository, LlmProvider, EmbeddingIndex, EmailSender, RateLimiter
  services/    chat-service, publish-kit, redaction-gate, markdown-twin,
               json-resume, command-palette, chunker, contact-schema, chat-schema

adapters (implement ports, own all I/O)
  content-git/      ContentRepository over Astro content collections
  llm/              workers-ai, anthropic, echo-dev + router (fallback chain)
  embedding-index/  lexical-index (dev), vectorize-index (prod)
  rate-limit/       in-memory (dev), kv (prod)
  email-*/          console (dev), resend (prod)

UI (consumes ports only, never adapters directly)
  components/astro/    static Astro components
  components/islands/  hydrated React islands
  layouts/, pages/      routes, API endpoints, PT-BR mirrors

config (the one place adapters get bound to ports)
  site.ts   siteConfig + the single `contentRepository` instance
  llm.ts    provider routing config
  nav.ts    site navigation, ai-agents.ts    bot-UA detection
```

`core` has zero imports from `astro`, `react`, or `@astrojs/*`. It's plain
TypeScript, unit-tested with Vitest, and portable to any runtime. Everything
in `core/services` is a pure function: same input, same output, no network
call, no clock read outside of what's passed in. That's deliberate — see
`docs/adr/0001-deterministic-first.md`.

## 2. The FE/BE boundary

Three execution contexts exist, and each piece of code belongs to exactly
one:

| Context | Runs | Examples | Can import |
|---|---|---|---|
| **Build-time (Node)** | `astro build`, standalone `tsx` scripts | `scripts/build-chat-index.ts`, `scripts/build-blueprint-graph.ts`, `scripts/publish-kit.ts`, `scripts/redaction-gate.ts` | `core/*` (pure TS, no Astro runtime needed) + Node's `fs` |
| **Edge (Cloudflare Worker)** | `/api/*` routes, `src/middleware.ts` | `pages/api/chat.ts`, `pages/api/contact.ts` | `core/ports` + adapters bound in `config/` |
| **Client (browser)** | Hydrated islands | `ChatWidget`, `AccessibilityPanel`, `CommandPalette` | Their own props only — no server-only imports, no `astro:content` |

The build-time scripts can't call `astro:content`'s `getCollection` — that
API only exists inside Astro's own build/dev pipeline, not in a standalone
`tsx` process. That's why `build-chat-index.ts`, `build-blueprint-graph.ts`,
and `publish-kit.ts` read `content/` off disk directly with `fs.readFile`
instead of going through `ContentRepository`. This is a real constraint, not
an oversight — but the *helper functions* built on top of that disk access
(frontmatter stripping, in particular) still belong in one place. See the
findings table below.

Islands are the tightest boundary: no island imports `astro:content`,
`node:fs`, or an adapter directly. Every island receives data as props from
the `.astro` file that mounts it. This was a real production bug once (the
aurora/NeuralField config had to be fixed after a server-only import leaked
into client code) — commit 3's architecture-test suite turns that fix into
a permanent guard.

## 3. Composability rules

1. **Single-definition policy.** A piece of logic — a formula, a schema, a
   constant, a geometry — is defined once and imported everywhere else. If
   two files need the same 5-line function, one of them imports it; neither
   retypes it. Full rationale in `docs/adr/0002-single-source-of-truth.md`.
2. **Tokens-only theming.** Color, spacing, and radius values live in
   `src/styles/tokens.css` as CSS custom properties. Components read
   `var(--accent)`, never a hex literal — with one documented exception:
   `src/lib/og-image.tsx` renders through satori, which can't resolve CSS
   custom properties at all, so it hardcodes the current token values as
   plain hex and says so in a comment. That's a real tool constraint, not a
   loophole — if the tokens change, `og-image.tsx` has to change with them
   by hand, and the comment says exactly that.
3. **Ports-only data access.** Pages and components call
   `contentRepository.getX()`, never `getCollection`/`getEntry` from
   `astro:content` directly. Swapping the git-backed adapter for a hosted
   CMS later should touch `src/adapters/content-git/` and nothing else.
4. **Adapters don't import each other.** `content-git` doesn't know
   `llm` exists; `rate-limit/kv` doesn't know `rate-limit/in-memory` exists.
   Each adapter implements a port and nothing more.
5. **The chatbot is the only LLM call path.** Every other feature —
   search, redaction, palette scoring, publish-kit generation, CV export —
   is a deterministic function. No feature quietly grows an LLM dependency
   without that being a visible, reviewed decision. Commit 3 turns this into
   a failing test, not just a convention.

## 4. Consolidated findings (V5c audit)

The audit read every content-loading path, every locale touchpoint, the
three no-flash init scripts, every date/reading-time/slug helper, the brand
SVG geometry across its four renderers, and all ten PT-BR page mirrors
against their EN counterparts. Most of what it found was already correctly
built — `ContentRepository`, `resolveLocale`/`getStrings`, the `motion.ts`
kill-switch pattern, and 9 of 10 PT-BR pages reusing their EN components
verbatim all held up. The table below is what didn't.

| # | Found | Where | Resolution |
|---|---|---|---|
| 1 | `stripMdxComponents` (MDX-tag-stripping regex) implemented three times | `src/core/services/markdown-twin.ts` (exported, pure), `scripts/build-chat-index.ts`, `scripts/publish-kit.ts` (both had their own copy, one commented "mirrors ...") | **Fixed.** Both scripts now import the one exported from `markdown-twin.ts`. |
| 2 | Reading-time formula (200 wpm, `Math.max(1, Math.round(words/200))`) implemented twice | `src/lib/remark-reading-time.ts` vs `src/adapters/content-git/content-repository.ts` | **Fixed.** One `computeReadingTime()` in a shared module; both call sites use it. The two-tier fallback in `writing/[slug].astro` (prefer the remark-exact value, fall back to the repository estimate) is a real, kept behavior — only the formula was duplicated, not the fallback logic. |
| 3 | `rss.xml.ts` re-implements `getArticles()`'s filter+sort instead of calling it | `src/pages/rss.xml.ts` | **Fixed.** Now calls `contentRepository.getArticles()` for the entity list and only uses raw `getCollection`/`render` for what the port can't provide (rendered MDX HTML). |
| 4 | Brand-mark "simplified 5+5-node" SVG geometry (paths + circle coordinates) copy-pasted across four renderers | `public/favicon.svg`, `ChatWidget.tsx`, `BaseLayout.astro`'s chat-launcher shell, `og-image.tsx` | **Fixed for the three that can share TS.** Coordinates extracted to `src/lib/brand-mark-geometry.ts`; `ChatWidget.tsx` and `BaseLayout.astro` import it. `favicon.svg` stays a static file (browsers fetch it directly, it can't import TS) and `og-image.tsx` stays hardcoded hex (satori can't resolve CSS vars) — both documented as structural, not fixed-by-import. |
| 5 | Three identical `Intl.DateTimeFormat({month:'short', day:'numeric', year:'numeric'})` constructions | `LatestWriting.astro`, `writing/index.astro`, `pt/writing/index.astro` | **Fixed.** Centralized in `src/lib/format-date.ts`. The `[slug].astro` (`long` month) and `dossier.astro`/`RoleChapter.astro` (year-only) formats are genuinely different shapes for different display contexts — kept as named variants in the same module, not forced into one function with a mode flag nobody would read correctly. |
| 6 | `formatDate` (parse `"YYYY-MM"` to month/year) duplicated identically | `experience/dossier.astro`, `RoleChapter.astro` | **Fixed.** Both now call `formatMonthYear()` from `src/lib/format-date.ts`. |
| 7 | `CONTACT_EMAIL` hardcoded instead of reading `siteConfig.contactEmail` | `src/components/islands/CommandPalette.tsx` | **Fixed.** Passed as a prop from `CommandPaletteMount.astro`, which already had `siteConfig` in scope. |
| 8 | Theme read/write logic (class toggle + `localStorage['theme']`) implemented three times | BaseLayout's no-flash script, `ThemeToggle.tsx`, `CommandPalette.tsx`'s `toggle-theme` action | **Fixed.** Extracted `src/lib/theme.ts` (mirrors the existing `motion.ts` pattern: `getTheme`/`setTheme`/`subscribeTheme`). All three call sites use it; the no-flash script keeps its own inline copy by necessity (it runs before any module can load) but now carries a comment pointing at `theme.ts` as the canonical logic it mirrors. |
| 9 | `{summary, detail}` shape repeated four times inline in one schema | `src/content.config.ts`'s `deepDive` field | **Fixed.** Extracted a local `summaryDetailSchema` constant, reused four times. |
| 10 | `pt/writing/index.astro` structurally diverges from `writing/index.astro` (no featured/rest split, adds an "em inglês" badge) rather than reusing shared markup | `src/pages/writing/index.astro`, `src/pages/pt/writing/index.astro` | **Kept as a documented variant, not force-merged.** The featured-article treatment and the EN-only badge are different product behavior, not accidental drift — collapsing them into one parameterized component would need a prop for every difference and buy nothing. Left as-is; flagged here so a future change to one lands deliberately on the other. |
| 11 | Three no-flash `<script is:inline>` blocks in `BaseLayout.astro` (theme / motion / contrast+text+accent) instead of one | `src/layouts/BaseLayout.astro` | **Kept as a documented variant.** Each block was added in a different phase (V2b, V2c) and writes to different, non-colliding `localStorage` keys and `data-*` attributes. Merging them saves one script-tag parse and buys nothing else; not worth the diff risk on a script that runs on every page load before first paint. |
| 12 | `[slug].md.ts` twins and `llms-full.txt.ts` fetch content twice — once via `contentRepository`, once via raw `getEntry`/`getCollection` for the raw MDX body | `src/pages/writing/[slug].md.ts`, `src/pages/projects/[slug].md.ts`, `src/pages/llms-full.txt.ts` | **Kept, documented as a port gap.** `ContentRepository`'s `Article`/`Project` entities don't expose raw MDX body — by design, since most callers want the parsed entity, not raw markdown. Adding a `getBody(slug)` method for the sake of three call sites would grow the port's surface for a narrow, twin-generation-only need. Noted here as a candidate if a fourth caller shows up. |
| 13 | Satori-safe hex fallback pattern `var(--accent, #4f8cff)` appears in `BrandMark.astro`, `ChatWidget.tsx`, `BaseLayout.astro` | brand-mark renderers | **Not a violation.** This is a CSS custom property with a literal fallback for the (rare) case the variable hasn't loaded — the token is still the source of truth; the hex is a safety net, not a second definition. No change made. |

## 5. What the audit deliberately did not touch

- **Rate-limit adapters** (`in-memory.ts` vs `kv.ts`) — different storage
  mechanisms implementing the same port. Correctly divergent.
- **DetailSheet vs InlineExpander** — two disclosure primitives for two
  different interaction patterns (modal popup vs inline expand), both
  specified separately in the V3b addendum. Not duplicates of each other.
- **Zod schemas for contact vs chat requests** — different request shapes,
  no shared fields worth extracting.
- **`pointer: fine` media-query check** appears as a one-line
  `matchMedia` call in both `card-motion.ts` and `hero-tier.ts`. A
  single-line query duplicated twice doesn't clear the bar for a shared
  module — the abstraction would cost more to read than the duplication
  does.

## 6. Guardrails against regression

`src/core/__tests__/architecture.test.ts` (added in the commit after this
document) statically scans the codebase's own imports so these rules stay
true without relying on code review catching every violation:

- Nothing under `src/core` imports `astro`, `react`, or `@astrojs/*`.
- Adapters don't import other adapters.
- Islands don't import server-only modules (`astro:content`, `node:fs`,
  adapter classes).
- Only `src/core/services/chat-service.ts` and `src/adapters/llm/*` may
  reference an LLM provider SDK or API.

See `docs/adr/0001-deterministic-first.md` and
`docs/adr/0002-single-source-of-truth.md` for the reasoning behind rules 5
and 1 above.
