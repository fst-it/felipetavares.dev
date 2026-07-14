# Chatbot ("Ask Felipe's AI")

Architecture, dev-fallback behavior, and deployment activation steps for the site's RAG chatbot —
per spec section 8 (Chatbot) and section 14 (Phase 4 acceptance).

## 1. Architecture — ports & adapters

Everything routes through two core ports so the whole feature is swappable and fully testable
without a Cloudflare account (spec section 4's hexagonal rule):

| Port | File | Dev/v1-prod adapter | Production adapter |
|---|---|---|---|
| `EmbeddingIndex` | `src/core/ports/embedding-index.ts` | `LexicalIndex` — pure-TS BM25-style scoring over `src/generated/chat-chunks.json`, no network | `VectorizeIndex` — embeds via Workers AI `bge-base-en-v1.5`, queries Cloudflare Vectorize |
| `LlmProvider` | `src/core/ports/llm-provider.ts` | `EchoDevProvider` — assembles a canned answer from the retrieved chunks, no keys/network | `WorkersAiProvider` (Llama 3.3 70B) primary; `AnthropicProvider` (Claude Haiku, REST+streaming) as an optional quality upgrade |

`src/config/llm.ts` is the single binding point (mirrors `src/config/site.ts`'s
`contentRepository` pattern): `getEmbeddingIndex(env)` and `getLlmProvider(env)` pick the concrete
adapter **automatically by presence/absence of the Cloudflare binding/secret** — the same pattern
as `ConsoleEmailSender` vs `ResendEmailSender` in phase 2. No flag to flip; just deploy with the
bindings present.

`src/adapters/llm/router.ts` (`LlmRouter`) implements `LlmProvider` itself, wrapping a primary +
ordered fallback list. It streams from the primary; if the primary throws *before* yielding any
output, it retries the next provider in the chain. Once a provider has started streaming, a later
error is surfaced rather than silently retried (avoids duplicating partial output to the client).

Request flow (`POST /api/chat`, `src/pages/api/chat.ts`):

```
zod-validate request
  → rate limit (RateLimiter port: KV in prod, in-memory in dev — reused from phase 2)
  → abuse-phrase pre-filter (core/services/chat-service.ts)
  → EmbeddingIndex.retrieve(question, topK=6)
  → chat-service.buildChatPrompt(history, question, chunks)  — pure, unit-tested
  → LlmRouter.complete(messages)                              — streamed
  → SSE to client: repeated `delta` events, then one `sources` event, then `done`
```

## 2. How the dev fallback works (no Cloudflare account needed)

Felipe currently has no Cloudflare account connected. Every capability below degrades to a
zero-credential local implementation, selected automatically:

- **Retrieval:** `src/generated/chat-chunks.json` is committed and built by
  `pnpm build-chat-index` (no network). `LexicalIndex` (BM25-style, pure TS) reads it directly —
  this is also the intended **v1 production** fallback if Vectorize isn't set up yet, not just a
  dev stub.
- **LLM:** with no `ANTHROPIC_API_KEY` and no `env.AI` binding, `getLlmProvider` falls through to
  `EchoDevProvider`, which builds a real, grounded (not fake) answer directly from the same
  retrieved chunks the real providers would see — so the full retrieval → prompt → stream →
  source-chips UX is testable end-to-end locally.
- **Rate limiting:** `InMemoryRateLimiter` (process-memory, resets on restart) is used whenever
  `env.RATE_LIMIT_KV` isn't bound — same adapter `/api/contact` already uses.

Running `pnpm dev` therefore exercises the entire chatbot with zero external credentials.

## 3. Deployment activation steps

Once Felipe connects a Cloudflare account and is ready to go live:

1. **Enable Workers AI** on the account (free tier, spec section 8's $0 budget: 10k neurons/day).
   No explicit "enable" step beyond having it available on the account — `wrangler.jsonc` already
   declares the `AI` binding.

2. **Create the Vectorize index** (one-time):
   ```
   wrangler vectorize create fst-chat --dimensions=768 --metric=cosine
   ```
   768 matches `bge-base-en-v1.5`'s output dimension. The binding name/index name (`VECTORIZE` /
   `fst-chat`) are already wired in `wrangler.jsonc`.

3. **Create the rate-limit KV namespace** (shared with `/api/contact`, if not already done in
   phase 2):
   ```
   wrangler kv namespace create RATE_LIMIT_KV
   ```
   Paste the returned `id` into `wrangler.jsonc`'s `kv_namespaces` entry.

4. **Populate Vectorize.** Workers AI embeddings are only reachable inside a Worker, so a plain
   `wrangler vectorize insert` won't work — that command expects pre-computed float vectors, not
   raw text. The proven path is a throwaway admin Worker that handles embed+upsert in one step.
   Full procedure in `scripts/vectorize-upsert/README.md`; quick sequence:
   ```
   pnpm build-chat-index --upsert          # writes src/generated/chat-chunks.upsert.ndjson
   cd scripts/vectorize-upsert/worker
   cp wrangler.json.example wrangler.json  # edit ADMIN_TOKEN to a random string
   npx wrangler deploy                     # note the worker URL
   cd <site-root>
   .\scripts\vectorize-upsert\push-chunks.ps1 -WorkerUrl <url> -AdminToken <token>
   npx wrangler vectorize info fst-chat    # confirm vectorCount matches chunk count
   cd scripts/vectorize-upsert/worker && npx wrangler delete fst-vectorize-admin
   ```
   (Re-run from `pnpm build-chat-index --upsert` whenever content changes — not wired into CI
   to keep Vectorize writes an explicit, reviewed step.)

5. **Optional: activate Anthropic as primary.** Set `ANTHROPIC_API_KEY` as a Cloudflare secret
   (`wrangler secret put ANTHROPIC_API_KEY`) or in `.dev.vars` locally. `getLlmProvider` in
   `src/config/llm.ts` already tries Anthropic first when the key is present — no code change
   needed to switch primary, only the secret.

6. **Optional: enable Cloudflare Web Analytics** (unrelated to the chatbot, but the same
   "connect Cloudflare account" moment — V3c commit 3). In the Cloudflare dashboard: Analytics &
   Logs → Web Analytics → Add a site (`felipetavares.dev`) → copy the `token` field from the
   generated snippet → set it as `PUBLIC_CF_ANALYTICS_TOKEN` (Pages/Workers env variable, or
   `.dev.vars` locally, see `.dev.vars.example`). `src/components/astro/Analytics.astro` renders
   the beacon script only when this token is present — absent by default, so the site ships with
   zero analytics/tracking until this step is done deliberately. See `/privacy` for the statement
   this is designed to keep true (cookieless, no consent banner needed).

7. **Deploy.** `wrangler deploy` (or the CI/CD pipeline from spec section 12). Bindings become
   active the moment the Worker sees them; nothing in local dev or `pnpm build` depends on them.

## 4. Rate limits & guardrails (spec sections 8 & 11)

- **Rate limit:** 20 messages/hour/IP, with a 5-message/5-minute burst cap layered on top (the
  `RateLimiter` port only expresses a single limit/window, so "burst" is a second, shorter window
  checked alongside the hourly one — both must pass). Returns HTTP 429 with a plain-language
  error when exceeded.
- **Abuse-phrase pre-filter:** `containsAbusePhrase` in `src/core/services/chat-service.ts` blocks
  the question before it reaches any provider if it matches common prompt-injection openers
  ("ignore previous instructions", "reveal your system prompt", "you are now...", "DAN", etc.).
  This is a cheap first line of defense, not a moderation system.
- **Grounding / injection resistance:** the system prompt is pinned server-side (never sent by the
  client) and explicitly instructs the model to treat the `<context>` block and the user's message
  as untrusted data, not instructions — retrieved site content and the user's question both sit
  inside delimited blocks the model is told not to take commands from.
- **Refusal fallback:** `DONT_KNOW_FALLBACK` points to Felipe's LinkedIn when retrieval finds
  nothing relevant or the LLM stream yields no output.
- **Output cap:** `MAX_OUTPUT_TOKENS = 800`, passed as `maxTokens` to every provider.
- **No persistence:** conversation history lives in the browser's `sessionStorage` only
  (`src/components/islands/ChatWidget.tsx`); the server never stores messages or PII.

## 5. Rebuilding the index

Run whenever content (articles/projects/roles/talks/site singleton) changes:

```
pnpm build-chat-index
```

Writes `src/generated/chat-chunks.json` (committed, deterministic — same chunks in, same chunks
out). This file is what `LexicalIndex` reads at runtime and what `--upsert` embeds into Vectorize.
