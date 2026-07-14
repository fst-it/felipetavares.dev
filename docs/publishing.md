# Publishing & Syndication

How an article moves from a Markdown file in this repo to felipetavares.dev, Dev.to, Hashnode,
Substack, LinkedIn, Reddit, and X — per spec section 9 (Publishing & Growth Pipeline).

## 1. Write → merge → syndicate (end-to-end flow)

1. **Write.** Add or edit `content/articles/<slug>.mdx` — directly, via Claude Code, or via the
   Keystatic UI at `/keystatic` in dev (`pnpm dev`). Required frontmatter: `title`, `description`,
   `pubDate`, `tags`. Optional: `updatedDate`, `heroImage`, `canonicalOverride`, `syndication`
   (`devto`/`hashnode`/`substack` URLs, filled in *after* those platforms have imported the post),
   `series`. Set `draft: true` while work-in-progress — draft articles are excluded from the
   `/writing` index, the article route (`getStaticPaths` filters `!data.draft`), `/rss.xml`, and
   `llms.txt`.
2. **Merge to `main`.** Push / merge the branch. CI (`pnpm check`, `pnpm test`, `pnpm build`)
   gates the merge.
3. **Auto-deploy.** Cloudflare Pages/Workers builds and deploys `main` automatically. The article
   is now live at `https://felipetavares.dev/writing/<slug>`, indexed in the sitemap, and present
   in `/rss.xml` with full HTML content.
4. **Auto-syndication (Dev.to + Hashnode).** Both platforms poll the RSS feed and import the post
   automatically — see section 2 below for the one-time setup. No action needed per article.
5. **Publish kit (Substack / LinkedIn / Reddit / X).** Run `pnpm publish-kit <slug>` and paste the
   four generated artifacts into each platform — see section 3.
6. **Newsletter.** The Substack embed (footer + end of every article,
   `src/components/astro/SubstackEmbed.astro`) reads `siteConfig.substackUrl` /
   `substackEmbedUrl` (`src/config/site.ts`). Substack itself is the email backbone — no
   additional email infrastructure runs on this site.

## 2. Dev.to & Hashnode RSS import (exact settings)

Both platforms support importing external posts by RSS feed and marking the *original* as
canonical, which is SEO-safe (no duplicate-content penalty) and effectively "set and forget" once
configured.

### Dev.to

1. Go to **Settings → Extensions** on dev.to (https://dev.to/settings/extensions).
2. Under **RSS Feed**, paste `https://felipetavares.dev/rss.xml`.
3. Dev.to polls the feed periodically and creates a draft/published post per new item.
4. Dev.to automatically sets `canonical_url` to the feed item's `<link>` (our article's own URL) —
   confirm this in each imported post's settings the first few times to be sure Dev.to preserved
   it; if not, add `canonical_url: https://felipetavares.dev/writing/<slug>` in that post's own
   front matter fields on Dev.to.
5. Once verified, no further per-article action is required — new RSS items import automatically.

### Hashnode

1. Go to your Hashnode blog dashboard → **Import from RSS** (Dashboard → "Import" /
   `https://hashnode.com/import`, or Blog Settings → **RSS Import** depending on current UI).
2. Paste `https://felipetavares.dev/rss.xml`.
3. Hashnode sets the canonical URL to the original post's link from the feed by default when
   importing — verify on the first import that "Canonical URL" on the imported post reads
   `https://felipetavares.dev/writing/<slug>`.
4. Hashnode re-polls the feed on an interval; new articles import without further action.

**Both platforms require the feed to already be live** — the RSS import setup above is therefore a
one-time step done *after* this site (and at least one article) is deployed.

## 3. Publish kit — per platform usage

Run:

```bash
pnpm publish-kit <slug>
```

This reads `content/articles/<slug>.mdx` (refuses to run on `draft: true` articles), renders the
MDX body through Astro's standalone markdown processor, and writes four files to
`publish-kits/<slug>/` (gitignored — never committed):

| File | Platform | How to use it |
|---|---|---|
| `substack.html` | Substack | Open the Substack post editor → switch to "Paste HTML" / use the editor's paste-from-clipboard behavior → paste the file contents. The first lines are a canonical-URL note (Substack has no native canonical field). All image/link URLs are absolutized to `https://felipetavares.dev/...` so they resolve outside this site's origin. |
| `linkedin.md` | LinkedIn | Copy the whole file into a new LinkedIn post. It's hook-first, ≤1300 characters, ends with the canonical link and 3–5 hashtags. |
| `reddit.md` | Reddit | Read the neutral framing note and the suggested-subreddits comment block first — **do not paste verbatim into every subreddit**; tailor tone/title per community rules (most technical subreddits penalize promotional framing). |
| `x-thread.md` | X (Twitter) | Each tweet is pre-split at sentence boundaries and numbered `n/total`; every individual tweet body is ≤280 characters. Post as a thread, one tweet per `---`-separated block. |

Budget ~2 minutes per platform to paste and do a final human read before publishing — this is a
deliberate manual step (see spec ADR 6: no write APIs exist for Substack/Medium/LinkedIn without
ToS risk, so kits replace full automation).

## 4. Keystatic

- **Local mode (current).** `pnpm dev` → visit `/keystatic`. Reads/writes the same files under
  `/content` that Astro's content collections read — there is exactly one content model, edited
  through three equivalent paths (direct file edit, Claude Code, or this UI).
- **Production build safety.** `astro.config.mjs` only registers the `@keystatic/astro`
  integration when Astro's `command !== 'build'` (i.e. `pnpm dev` and `pnpm preview` get it,
  `pnpm build` does not). The integration injects two non-prerendered routes (`/keystatic/...`,
  `/api/keystatic/...`); gating at the integration-registration level means `astro build` never
  creates those routes at all, rather than relying on a per-route runtime guard. There is
  currently no Keystatic admin surface in the deployed site.
- **TODO — GitHub-mode storage.** To edit content in production (e.g. from a phone, without a
  local checkout) `keystatic.config.ts`'s `storage.kind` needs to change from `'local'` to
  `'github'`, pointing at a GitHub App that:
  - Is installed on the `fst-it` (or wherever this repo ends up) org/repo with contents:
    read/write and pull-request:write permissions.
  - Has its App ID / private key / installation ID set as Cloudflare env secrets, referenced by
    the (currently absent) `/api/keystatic/[...params]` server route once it's re-enabled for
    production.
  - This is deliberately deferred — it needs Felipe to actually create the GitHub App, which is an
    account-level action outside this codebase change.

## 5. Pre-deploy checklist — Cloudflare secrets

The following environment variables must be set as **Cloudflare Pages/Workers secrets** (dashboard
→ Settings → Environment variables → Production). They must never be committed to the repo.

| Secret | Required | Where to set | Notes |
|---|---|---|---|
| `PUBLIC_TURNSTILE_SITEKEY` | Yes | Cloudflare Pages env (build-time) | Real widget key set (2026-07-11). Baked at build with `PUBLIC_TURNSTILE_SITEKEY=<sitekey> pnpm build`. The always-pass dev fallback (`1x00000000000000000000AA`) is only used locally when the env var is absent. |
| `TURNSTILE_SECRET` | Yes | Cloudflare Workers secret | Real secret set (2026-07-11). Set via `wrangler pages secret put TURNSTILE_SECRET --project-name=felipetavares-dev`. The always-pass dev fallback (`1x0000000000000000000000000000000AA`) is only used when the secret is absent at runtime. |
| `RESEND_API_KEY` | Yes | Cloudflare Workers secret | Powers `POST /api/contact` (email delivery via Resend). Without it the contact form 500s. Owner has the key — add via `wrangler secret put RESEND_API_KEY`. |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional | Cloudflare Pages env | Web Analytics beacon token from the Cloudflare Analytics dashboard. Absent = analytics off (no error). |
| `ANTHROPIC_API_KEY` | Optional | Cloudflare Workers secret | Powers the `/api/chat` LLM path. Absent = chat adapter falls back to stub/console mode. |

Also run `pnpm placeholder-gate` after `pnpm build` to confirm no placeholder hero copy shipped
(see `scripts/placeholder-gate.ts`).

### Vectorize chat index (deploy-day step)

`src/generated/chat-chunks.json` is committed and kept current by `pnpm build-chat-index` (run
locally after any content change). The production `VectorizeIndex` adapter requires an additional
upsert into Cloudflare Vectorize — this cannot run from a local Node script because Workers AI
embeddings are only reachable inside a Worker, not from Node.

The proven procedure uses a throwaway admin Worker that handles the embed+upsert in one step and
is immediately deleted. Full instructions at `scripts/vectorize-upsert/README.md`. Quick summary:

1. `pnpm build-chat-index --upsert` — writes `src/generated/chat-chunks.upsert.ndjson`.
2. Deploy the admin Worker: `cd scripts/vectorize-upsert/worker && npx wrangler deploy`.
3. Run `.\scripts\vectorize-upsert\push-chunks.ps1 -WorkerUrl <url> -AdminToken <token>`.
4. Verify: `npx wrangler vectorize info fst-chat` → vectorCount matches chunk count (~59).
5. Delete the Worker: `cd scripts/vectorize-upsert/worker && npx wrangler delete fst-vectorize-admin`.

Until Vectorize is populated, the chat panel falls back to the local `LexicalIndex` backed by
the committed `chat-chunks.json` — the chat works, but semantic search quality is lower.

See `scripts/vectorize-upsert/README.md` for the full procedure and schema notes.

## 6. Draft handling

`draft: true` on an article excludes it from:
- `/writing` and `/writing/tags/[tag]` listings (`ContentRepository.getArticles()` filters drafts
  by default; pass `{ includeDrafts: true }` explicitly where needed).
- The article's own static route (`/writing/[slug].astro`'s `getStaticPaths` filters
  `!data.draft`, and the page redirects to `/writing` if a draft slug is requested directly).
- `/rss.xml` and `llms.txt` (both call `getCollection('articles', ({ data }) => !data.draft)` or
  `getArticles()` without `includeDrafts`).

This means a draft is safe to keep on `main` mid-revision without it leaking into feeds or
syndication.

## 7. Public repo sync

The public repo at github.com/fst-it/felipetavares.dev was created as a fresh-start export:
one commit containing the filtered tree, with no local history pushed (the local main branch
carries pre-redaction commits that must stay private).

The following paths are excluded from every public export (see `$EXCLUDE_PATHS` in the script):
- `docs/superpowers/` — personal specs, owner complaint ledger, internal design notes
- `docs/AI Brain Hero Options (standalone).html` — design mockup with client names
- `docs/AI Brain Circuit Prototype.zip` — binary design archive

To push a new snapshot after a batch of local changes, run the export script:

```powershell
pwsh scripts/export-public.ps1
# optional custom subject line:
pwsh scripts/export-public.ps1 -Message "feat: add reading section"
```

The script (`scripts/export-public.ps1`) does the following in order:

1. Verifies the working tree is clean.
2. Builds a filtered tree from HEAD using a temporary git index (leaves the real index and
   working tree untouched): reads HEAD into the temp index, removes every path in `$EXCLUDE_PATHS`,
   then calls `git write-tree` to produce the filtered tree SHA.
3. Runs two safety checks against the filtered tree before any push:
   - `git ls-tree -r --name-only <tree>` must not contain any excluded path.
   - `git grep -i` for the configured `$DENY_PATTERNS` (company names, personal email, and
     machine paths — see the script for the exact list) must return no matches.
   The script aborts loudly if either check fails.
4. Creates an orphan commit via `git commit-tree <tree> -F <msg-file>` with the subject line
   and a body noting "Filtered fresh-start export: docs/superpowers excluded" plus the
   `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
5. Force-pushes `<commit>:refs/heads/main` to https://github.com/fst-it/felipetavares.dev.git.
6. Prints the pushed commit SHA and tree SHA.

The public remote is aliased as `public`:

```bash
git remote add public https://github.com/fst-it/felipetavares.dev.git
```

**Never run `git push public` or `git push --set-upstream public main` without the script.**
The default push sends the full local history, which contains pre-redaction commits.

The recommended cadence: batch several local features, then run one export. Keep the public
changelog in `content/engineering.json` so readers see what changed without exposing commit
granularity.
