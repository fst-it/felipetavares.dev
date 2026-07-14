import type { APIRoute } from 'astro';
import { chatRequestSchema } from '../../core/services/chat-schema';
import {
  buildChatPrompt,
  containsAbusePhrase,
  dedupeSources,
  DONT_KNOW_FALLBACK,
  MAX_OUTPUT_TOKENS,
} from '../../core/services/chat-service';
import { getLlmProvider, getEmbeddingIndex, type ChatRuntimeEnv } from '../../config/llm';
import { InMemoryRateLimiter } from '../../adapters/rate-limit/in-memory';
import { KvRateLimiter, type KvNamespaceLike } from '../../adapters/rate-limit/kv';

export const prerender = false;

// 20 msg/hr/IP with a burst allowance of 5 (spec section 8). The fixed-window RateLimiter port
// only expresses a single limit/window pair, so "burst 5" is modeled as a short 5-minute window
// capping at 5 requests, layered under the hourly 20 cap — both must pass.
const HOURLY_LIMIT = { limit: 20, windowSeconds: 60 * 60 };
const BURST_LIMIT = { limit: 5, windowSeconds: 5 * 60 };

const TOP_K = 6;

// Dev fallback: process-memory limiter so `pnpm dev` works without a KV binding, matching
// /api/contact's pattern. The deployed Worker always has RATE_LIMIT_KV bound.
const devRateLimiter = new InMemoryRateLimiter();

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400);
  }

  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      400
    );
  }

  const env = ((locals as { runtime?: { env?: ChatRuntimeEnv } }).runtime?.env ?? {}) as ChatRuntimeEnv;
  const kvBinding = (env as unknown as Record<string, unknown>).RATE_LIMIT_KV as KvNamespaceLike | undefined;

  let ip = 'unknown';
  try {
    ip = clientAddress ?? 'unknown';
  } catch {
    // clientAddress throws outside adapters that support it (e.g. some dev contexts).
  }

  const rateLimiter = kvBinding ? new KvRateLimiter(kvBinding) : devRateLimiter;
  const [hourly, burst] = await Promise.all([
    rateLimiter.check(`chat:hour:${ip}`, HOURLY_LIMIT),
    rateLimiter.check(`chat:burst:${ip}`, BURST_LIMIT),
  ]);
  if (!hourly.allowed || !burst.allowed) {
    return jsonResponse({ ok: false, error: 'Too many messages. Please try again in a bit.' }, 429);
  }

  const { messages } = parsed.data;
  const question = messages[messages.length - 1]?.content ?? '';
  const history = messages.slice(0, -1);

  if (containsAbusePhrase(question)) {
    return jsonResponse(
      { ok: false, error: "I can't help with that. Try asking about Felipe's work or experience." },
      400
    );
  }

  const embeddingIndex = getEmbeddingIndex(env);
  const chunks = await embeddingIndex.retrieve(question, TOP_K);

  const llm = getLlmProvider(env);
  const promptMessages = buildChatPrompt({ history, question, chunks });
  const sources = dedupeSources(chunks);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let yieldedAny = false;
        for await (const delta of llm.complete(promptMessages, { maxTokens: MAX_OUTPUT_TOKENS })) {
          yieldedAny = true;
          controller.enqueue(encoder.encode(sseEvent('delta', { text: delta })));
        }
        if (!yieldedAny) {
          controller.enqueue(encoder.encode(sseEvent('delta', { text: DONT_KNOW_FALLBACK })));
        }
        controller.enqueue(encoder.encode(sseEvent('sources', { sources })));
        controller.enqueue(encoder.encode(sseEvent('done', {})));
      } catch (error) {
        console.error('[api/chat] stream failed:', error);
        controller.enqueue(
          encoder.encode(
            sseEvent('error', { message: "Something went wrong. Reach Felipe directly on LinkedIn." })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
