# AGENTS.md — felipetavares.dev

AI agent entry point. Read this first, then follow the pointers for the area you are working in.
Cross-tool convention: Codex, OpenCode, Copilot, Cursor, and most CLI agents pick this file up
automatically.

---

## What this project is

Personal-brand site for Felipe Tavares (enterprise architect and AI engineering leader) at
felipetavares.dev. Full description and stack in [README.md](README.md).

---

## Architecture — read the source, not this summary

Full layer map, execution-context boundary (build-time / edge Worker / client island), and
composability rules: [docs/architecture.md](docs/architecture.md).

Decisions behind the rules:
- [docs/adr/0001-deterministic-first.md](docs/adr/0001-deterministic-first.md)
- [docs/adr/0002-single-source-of-truth.md](docs/adr/0002-single-source-of-truth.md)

**Non-negotiables (inline because they have immediate impact on every change):**

- Hexagonal boundaries are test-enforced: `src/core` stays framework-free, adapters never
  import each other, UI components consume ports only. `pnpm test` will catch violations.
- Tokens-only theming: no raw color values outside `src/styles/tokens.css`.
- Single-definition policy: one authoritative definition per entity, adapter, or component;
  no parallel implementations.
- Deterministic-first: all content is static or computed at build time. LLM calls go only
  through the chat path (`src/adapters/llm/`); nowhere else.
- Redaction gate must stay green: `pnpm redaction-gate` must pass on every commit. Employer-
  tied financial figures and headcounts are banned from content and built output.
- Content facts are never invented: every claim in `content/` traces to private
  source-of-truth notes.

---

## Quality gates

See [README.md — Quality gates](README.md#quality-gates) for the command table.

Gates that run on every PR (`.github/workflows/ci.yml`): `pnpm check` → `pnpm test` →
`pnpm redaction-gate` → `pnpm build` → `pnpm redaction-gate` (dist scan) → `pnpm e2e`.

Do not merge if any gate is red.

---

## Writing voice

All prose in this repo follows [docs/style/voice.md](docs/style/voice.md). That file governs
website copy, content JSON/MDX, docs, and UI microcopy in both EN and PT-BR.

---

## Per-area entry points

| Area | Where to start |
|---|---|
| Domain logic (entities, ports, services) | `src/core/` |
| I/O adapters (LLM, content, email, rate limit) | `src/adapters/` |
| MCP server | `packages/mcp/` — full docs in `docs/mcp.md` |
| Content (roles, articles, projects, talks) | `content/` — zod schemas in `src/content.config.ts` |
| Build and CI scripts | `scripts/` |
| Design decisions and audit findings | `docs/` |

---

## content/engineering.json — changelog curation rule

Append to the `changelog` array only for visitor-visible capability changes written at executive level: a feature that went live, infrastructure a visitor can observe, or a content section launched. Internal fixes, test cleanup, architecture refactors, and process changes do not belong there. (JSON has no comment syntax; this rule lives here as the single authoritative reference.)

---

## Working here

- Run `pnpm install` once, then `pnpm dev` to start the local server.
- Before opening a PR: `pnpm check && pnpm test && pnpm redaction-gate && pnpm build`.
- Content edits can go through the Keystatic UI at `/keystatic` (dev server) or directly in
  `content/`.
- After editing `content/roles/*.json` or `content/site.json`, rebuild the chat index:
  `pnpm build-chat-index`.
