# felipetavares.dev

Personal-brand site for [Felipe Tavares](https://felipetavares.dev) — enterprise architect and AI engineering leader.

[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Astro 5](https://img.shields.io/badge/Astro-5-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F48120?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**Live site: [felipetavares.dev](https://felipetavares.dev)**

Built like a product: hexagonal architecture, a content pipeline enforced in CI, and a hard $0/month infrastructure constraint. Every fact traces to a private source-of-truth note. Nothing is invented.

## ✨ Features

- AI chatbot with retrieval over site content, using Workers AI first and Anthropic as a config-swappable fallback
- MCP server at [mcp.felipetavares.dev](https://mcp.felipetavares.dev): typed tools for career data, content search, and grounded chat
- Redaction gate in CI: employer-tied financial figures and headcounts never reach the public site
- $0/month recurring cost: Pages, Workers, KV, Vectorize, and Workers AI run inside Cloudflare's free tier
- Hexagonal architecture with port boundaries enforced by unit tests on every commit
- Agent-ready surfaces: `llms.txt`, markdown twins, JSON Resume endpoint, and a well-known API catalog

## 🏗️ Architecture

`src/core` is pure TypeScript — entities, ports, and services with zero framework imports. Adapters under `src/adapters` implement those ports for content, LLM, embeddings, email, and rate limiting. Pages and components consume ports only, bound once in `src/config`.

Content pages prerender to the CDN at build time. Routes that need a server (`/api/contact`, `/api/chat`) run as Cloudflare Workers functions. Full layer map in [`docs/architecture.md`](docs/architecture.md). AI agents working in this repo should start with [`AGENTS.md`](AGENTS.md).

## 🚀 Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Astro 5 (hybrid output, islands architecture) |
| Client islands | React 19 |
| Styling | Tailwind CSS v4, token-first |
| Language | TypeScript (strict) |
| Hosting | Cloudflare Pages + Workers |
| Chatbot + retrieval | Cloudflare Workers AI + Vectorize |
| Rate limiting | Cloudflare KV |
| Email | Resend |
| Bot protection | Cloudflare Turnstile |
| Content + CMS | Astro content collections (MDX/JSON, git-backed), Keystatic |
| Motion | GSAP, Lenis, OGL |
| Agent protocol | MCP server (`packages/mcp`) |
| Testing | Vitest (unit), Playwright (E2E) |
| Validation | Zod |

## 🤖 Agent-ready

Any MCP-capable agent (Claude Code, Cursor, OpenCode) can connect to the MCP server and query career data, search articles, or start a grounded chat — no HTML scraping required. Machine-readable surfaces:

- `/llms.txt` — site overview for AI crawlers
- Markdown twin for every page (`/home.md`, `/experience.md`, etc.)
- `/api/cv.json` — JSON Resume endpoint with all seven roles
- `/.well-known/api-catalog` — RFC 9724 link to all machine-readable endpoints
- `/.well-known/mcp/server-card.json` — MCP server discovery card

Full docs in [`docs/mcp.md`](docs/mcp.md) and [`docs/ai-ready.md`](docs/ai-ready.md).

## Commands

All commands run from the repository root:

| Command | Action |
| :--- | :--- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start local dev server at `localhost:4321` |
| `pnpm build` | Build the production site to `./dist/` |
| `pnpm check` | `astro check` + `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm e2e` | Playwright suite against a fresh dev server |
| `pnpm redaction-gate` | Scan for employer-tied figures in content and build output |

## Quality gates

| Command | What it checks |
| :--- | :--- |
| `pnpm check` | `astro check` + `tsc --noEmit` — types, content-collection schemas |
| `pnpm test` | Vitest unit tests for `core/services` and adapters, plus the architecture boundary test that statically scans imports to enforce the hexagonal rules |
| `pnpm redaction-gate` | Scans `content/`, the chat index, and `dist/` (when present) for employer-tied financial figures and headcounts |
| `pnpm build` | Production build — prerenders every route, generates OG images |
| `pnpm e2e` | Playwright smoke suite (Chromium, WebKit, mobile-WebKit) |

## 📄 License

Dual-licensed. Source code is [MIT](LICENSE). Everything under `content/` (articles, CV data, brand copy, images) is all rights reserved — see [`content/LICENSE.md`](content/LICENSE.md) for what's allowed.
