/**
 * Throwaway admin Worker: embed chunks via Workers AI and upsert into the fst-chat Vectorize index.
 *
 * POST /upsert  body: [{id, metadata: {url, title, type, text}}]
 * GET  /health  liveness check
 *
 * ADMIN_TOKEN is set via `wrangler secret put ADMIN_TOKEN` (preferred) or the vars block in
 * wrangler.json.example. Generate any random string; it only guards the ~5 minute window this
 * worker is alive. Change it before deploying — never reuse a token across deployments.
 *
 * Delete this worker immediately after use:
 *   npx wrangler delete fst-vectorize-admin
 * (Run from this directory, not from the site root — wrangler detects the Pages project there.)
 */

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const auth = request.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, index: 'fst-chat' });
    }

    if (request.method === 'POST' && url.pathname === '/upsert') {
      let chunks;
      try {
        chunks = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return Response.json({ error: 'Body must be a non-empty array' }, { status: 400 });
      }

      const texts = chunks.map((c) => c.metadata.text);
      let embedded;
      try {
        embedded = await env.AI.run(EMBEDDING_MODEL, { text: texts });
      } catch (err) {
        return Response.json({ error: 'AI embedding failed', detail: String(err) }, { status: 500 });
      }

      if (!embedded?.data || embedded.data.length !== chunks.length) {
        return Response.json(
          { error: 'Embedding count mismatch', got: embedded?.data?.length, expected: chunks.length },
          { status: 500 }
        );
      }

      // Build vectors with the exact metadata schema VectorizeIndex.retrieve() expects:
      //   url, title, type, text  (see src/adapters/embedding-index/vectorize-index.ts)
      const vectors = chunks.map((chunk, i) => ({
        id: chunk.id,
        values: embedded.data[i],
        metadata: {
          url: chunk.metadata.url,
          title: chunk.metadata.title,
          type: chunk.metadata.type,
          text: chunk.metadata.text,
        },
      }));

      try {
        await env.VECTORIZE.upsert(vectors);
      } catch (err) {
        return Response.json({ error: 'Vectorize upsert failed', detail: String(err) }, { status: 500 });
      }

      return Response.json({ ok: true, upserted: vectors.length });
    }

    return new Response('Not found', { status: 404 });
  },
};
