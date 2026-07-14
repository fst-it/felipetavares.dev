# Vectorize upsert — proven procedure

Populates the `fst-chat` Cloudflare Vectorize index (768-dim cosine, bge-base-en-v1.5) from the
chunks built by `pnpm build-chat-index`. Run this whenever content changes and you need to refresh
the production semantic search.

## Why a Worker, not `wrangler vectorize insert`

Workers AI embeddings (bge-base-en-v1.5) are only callable from inside a Cloudflare Worker — they
cannot be reached from a local Node.js script. `wrangler vectorize insert` accepts a file of
pre-computed float vectors, but there is no official CLI to compute those embeddings locally. The
approach here deploys a minimal throwaway Worker that receives raw text chunks, embeds them via the
Workers AI binding, upserts the vectors, and is immediately deleted.

## Prerequisites

- `wrangler` authenticated (`npx wrangler whoami` shows your account)
- `pnpm build-chat-index --upsert` run from the site root (writes
  `src/generated/chat-chunks.upsert.ndjson`)

## Steps

### 1. Build the ndjson

```
cd <site-root>
pnpm build-chat-index --upsert
```

Confirms the ndjson exists at `src/generated/chat-chunks.upsert.ndjson`.

### 2. Deploy the admin Worker

```
cd scripts/vectorize-upsert/worker
cp wrangler.json.example wrangler.json
```

Edit `wrangler.json`: replace `CHANGE-ME-TO-A-RANDOM-STRING` with any random token, e.g.:
```
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Then deploy:

```
npx wrangler deploy
```

Note the worker URL printed (e.g. `https://fst-vectorize-admin.YOUR-ACCOUNT.workers.dev`).

### 3. Push chunks

From the site root:

```powershell
.\scripts\vectorize-upsert\push-chunks.ps1 `
  -WorkerUrl "https://fst-vectorize-admin.YOUR-ACCOUNT.workers.dev" `
  -AdminToken "your-random-token"
```

Expected output: `Done. Upserted 59 / 59 chunks.` (count changes as content grows).

### 4. Verify

```
npx wrangler vectorize info fst-chat
```

`vectorCount` should match the chunk count (Vectorize processes asynchronously — wait ~30s if
the count is lower than expected, then re-run).

### 5. Delete the Worker

**Do not leave the admin Worker running.** Delete it immediately:

```
cd scripts/vectorize-upsert/worker
npx wrangler delete fst-vectorize-admin
```

Note: run this from the `worker/` subdirectory, not from the site root — wrangler detects the
Pages project there and blocks Workers commands.

Confirm the worker URL returns 404 to verify deletion.

## Schema matched

The Worker upserts vectors with the exact metadata fields `VectorizeIndex` reads at query time
(`src/adapters/embedding-index/vectorize-index.ts`):

| Field | Source |
|---|---|
| `id` | `chunk-N` (sequential, overriding the chunk's url-based id to avoid collisions) |
| `metadata.url` | chunk URL (e.g. `/experience`, `/projects/selfwright`) |
| `metadata.title` | chunk title |
| `metadata.type` | `article`, `project`, `role`, `talk`, or `site` |
| `metadata.text` | full chunk text (used by LLM for grounding) |
| `values` | 768-dim float32 from `@cf/baai/bge-base-en-v1.5` |

## Known issue: duplicate IDs in ndjson

`scripts/build-chat-index.ts` generates chunk IDs as `${url}#${indexWithinSource}`. Because
multiple content types share the same URL (e.g. `/experience` is used by all roles), the ndjson
contains duplicate IDs (`/experience#0` appears 7 times). This script works around the collision
by substituting sequential `chunk-N` IDs. The ID field is only used for Vectorize deduplication;
the query path reads only metadata fields, so the substitution is safe. The underlying bug should
be fixed in `scripts/build-chat-index.ts` (make IDs globally unique across all chunks).
