# MCP server

`packages/mcp` publishes felipetavares.dev's content — CV, projects, articles, positioning — and a
grounded chatbot as a Model Context Protocol (MCP) server. Any MCP-aware AI agent (Claude Desktop,
Claude Code, a custom agent loop) can install it and query the site directly instead of scraping
HTML.

## Why this exists

The site already publishes machine-readable layers — markdown twins, `llms.txt`, `/api/cv.json`
(see `docs/ai-ready.md`). MCP is the same idea taken one step further: instead of an agent fetching
URLs and parsing markdown, it calls typed tools with validated inputs and gets structured JSON back.
`get_cv` returns the exact same JSON Resume document `/api/cv.json` serves; `search_content` runs
the same lexical index the site's own chatbot uses. Nothing here is a second copy of the truth —
every tool reads from the same `src/core` services and content the HTML site does (see
`docs/architecture.md` and ADR 0002).

## Tools

| Tool | Kind | What it does |
|---|---|---|
| `get_cv` | deterministic | Returns the JSON Resume document — basics, work history, education, skills, languages, certificates. Identical to `/api/cv.json`. |
| `get_profile` | deterministic | Positioning statement, the 12 domains of expertise (ordered by prominence), and public links. |
| `search_content` | deterministic | Lexical (BM25) search across every published page. `{query, limit≤10}` → scored matches with `url`, `title`, `type`, `score`, a short excerpt. |
| `get_page` | deterministic | Full markdown content of one page — a fixed set of static paths, or `/projects/<slug>` / `/writing/<slug>`. Unknown paths return `{error}`, never a filesystem error. |
| `list_projects` | deterministic | Metadata for every project (slug, title, tagline, status, stack, links) — no full body. |
| `list_articles` | deterministic | Metadata for every published article (slug, title, description, tags, dates, reading time) — drafts are never included. |
| `ask_felipe` | LLM-backed | Natural-language Q&A, grounded in retrieved site content — the same retrieval-augmented path behind the "Ask Felipe's AI" widget. Returns `{answer, sources}`. |
| `leave_message` | mutation | Sends a plain-text email to Felipe on an agent's user's behalf. `{senderName, senderContact, message, context?}` → `{delivered}`. |

Example call:

```json
{ "name": "search_content", "arguments": { "query": "selfwright architecture", "limit": 5 } }
```

### Deterministic-first, one exception

Per ADR 0001, this site treats an LLM call as something that needs a specific reason, not a
default. Six of the eight tools above never touch a model — they're pure lookups and a hand-rolled
BM25 scorer, the same logic the site's search and CV export already run on. `ask_felipe` is the one
exception, and it routes through the site's existing chatbot path
(`src/core/services/chat-service.ts` + `src/adapters/llm/*`) rather than adding a second LLM
integration. `leave_message` never calls a model at all — it's a validated, templated email.

## Security model

Every tool call passes through one composable shell
(`packages/mcp/src/security/shell.ts`) before the handler runs:

**Per-identity rate limits** (per caller, per tool class):

| Tool class | Limit |
|---|---|
| Deterministic reads (`get_cv`, `get_profile`, `get_page`, `list_projects`, `list_articles`) | 60/hour |
| `search_content` | 30/hour |
| `ask_felipe` | 10/hour |
| `leave_message` | 3/day |

**Global daily circuit breakers**, independent of who's calling, protecting the shared free-tier
quotas behind `ask_felipe` (an LLM call) and `leave_message` (an outbound email): 200/day and
20/day by default, overridable via `MCP_ASK_FELIPE_DAILY_LIMIT` / `MCP_LEAVE_MESSAGE_DAILY_LIMIT`.

**Fail-open vs. fail-closed**, if the rate-limit backend itself errors:

- Deterministic reads and search fail **open** — a limiter outage shouldn't take down a free,
  side-effect-free lookup.
- `ask_felipe` and `leave_message` fail **closed** — an LLM call or an outbound email is real cost
  and real exposure; an unknown limiter state must not silently permit it.

**Non-leaky errors.** Every error returned to a caller is a fixed, generic string ("Rate limit
exceeded. Please try again later.", "This tool is temporarily unavailable. Please try again
shortly.") — never a stack trace, a binding name, or a backend error message. Logging never
includes message bodies, questions, or any caller-supplied text; only the tool name and the
identity key already used for rate-limit bucketing.

**`get_page`'s allow-list.** `path` is checked against a fixed set of static routes plus a
restricted slug pattern (`/projects/<slug>`, `/writing/<slug>`) before any lookup runs — there is
no code path from an input string to a filesystem read. A path-traversal attempt
(`../../../etc/passwd`) fails the allow-list and returns a structured `{error}`, exactly like an
unknown slug.

**`leave_message`'s honesty rule.** Every delivered email states plainly that it was sent by an AI
agent on its user's behalf — never presented as a message the human typed directly, and there's no
reply channel back to the calling agent.

## Local usage (stdio)

```bash
npx felipetavares-mcp
```

No credentials needed — every tool works immediately. `ask_felipe` and `leave_message` upgrade
automatically once `ANTHROPIC_API_KEY` / `RESEND_API_KEY` are set in the environment; otherwise they
use the same zero-credential dev fallbacks the site itself uses locally (a grounded retrieval-based
answer with no model call; a console-logged email).

Claude Desktop / Claude Code config:

```json
{
  "mcpServers": {
    "felipetavares": {
      "command": "npx",
      "args": ["-y", "felipetavares-mcp"]
    }
  }
}
```

## Remote usage

Once deployed, the server will be reachable at `https://mcp.felipetavares.dev/mcp` (streamable
HTTP, one JSON-RPC request per call, no session). Not live yet — see Deployment below.

## Deployment activation steps

The server isn't deployed — no Cloudflare account is connected to this repo yet. Everything below
is the config and code that's ready for the moment that changes:

1. **Create the KV namespace** for rate limiting:
   ```
   wrangler kv namespace create MCP_RATE_LIMIT_KV
   ```
   Paste the returned `id` into `packages/mcp/wrangler.jsonc`'s `kv_namespaces` entry.

2. **Optional: set `ANTHROPIC_API_KEY`** as a Worker secret to upgrade `ask_felipe` from the
   echo-dev fallback to a real Claude Haiku call:
   ```
   wrangler secret put ANTHROPIC_API_KEY
   ```

3. **Optional: set `RESEND_API_KEY`** the same way, to upgrade `leave_message` from console
   logging to a real delivered email.

4. **Deploy:**
   ```
   cd packages/mcp && wrangler deploy
   ```

5. **Publish to npm** (stdio path), once ready:
   ```
   cd packages/mcp && npm publish
   ```
   `npm pack --dry-run` has already been verified to produce a clean, minimal tarball
   (`dist/stdio.js` + its sourcemap + `README.md` — the Worker build is excluded).

Whenever `content/` changes, rebuild the snapshot both transports read:

```
pnpm --filter felipetavares-mcp build-content-snapshot
```

## Verification

A real MCP handshake (stdio, built package) — `initialize` → `tools/list` → `tools/call`:

```
> tools/list
["get_cv", "get_profile", "search_content", "get_page", "list_projects", "list_articles", "ask_felipe", "leave_message"]

> tools/call get_cv {}
{ "basics": { "name": "Felipe Tavares", ... }, "work": [...], ... }

> tools/call search_content {"query": "selfwright", "limit": 3}
{ "results": [{ "url": "/projects/selfwright", "title": "Selfwright", "score": 4.178, "excerpt": "..." }, ...] }
```

The same handshake was repeated against a genuinely running Cloudflare Worker (`wrangler dev`) and
against a package installed from a real `npm pack` tarball into a throwaway project — both produced
identical results. See the packages/mcp test suite (`pnpm --filter felipetavares-mcp test`) for the
full adversarial coverage: path traversal, oversized inputs, injection strings, rate-limit
exhaustion, and fail-open/fail-closed behavior under a simulated limiter outage.
