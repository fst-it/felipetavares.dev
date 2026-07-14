/**
 * Cloudflare Worker entry point — the remote MCP transport (mcp.felipetavares.dev, once deployed;
 * see docs/mcp.md for activation steps). NOT deployed as part of this change (no Cloudflare
 * account connected yet) — this is the config + code ready for that step.
 *
 * Uses FetchTransport (./worker/fetch-transport.ts) rather than the SDK's
 * StreamableHTTPServerTransport, which is built directly against Node's IncomingMessage/
 * ServerResponse and doesn't run in the Workers Fetch-API runtime (see that file's header comment
 * for the specific evidence). Stateless: every POST /mcp request builds a fresh McpServer +
 * FetchTransport pair, processes exactly one JSON-RPC message, and returns — no session state, no
 * Durable Object, matching this deployment's $0 Workers model.
 *
 * Identity for rate-limiting is the request's client IP (CF-Connecting-IP), the same signal
 * src/pages/api/chat.ts's `clientAddress` already uses.
 */
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { RateLimiter } from '../../../src/core/ports/rate-limiter.js';
import { createServer } from './server.js';
import { FetchTransport } from './worker/fetch-transport.js';
import { KvRateLimiter, type KvNamespaceLike } from '../../../src/adapters/rate-limit/kv.js';
import { identityFromRequest } from './security/identity.js';
import type { McpEnv } from './config.js';

export interface WorkerEnv extends McpEnv {
  RATE_LIMIT_KV?: KvNamespaceLike;
}

/** RATE_LIMIT_KV missing at runtime should surface as a real limiter-backend error, not silently
 *  behave as "always allow" — the security shell's own fail-open (read/search) vs fail-closed
 *  (ask_felipe/leave_message) rule (security/shell.ts) is what decides the outcome, per tool
 *  class, exactly as it does for a genuine KV outage. A deployed Worker always has this bound
 *  (wrangler.jsonc); the only time it's legitimately absent is local `wrangler dev` without a real
 *  namespace, which should behave the same as any other limiter-backend failure. */
class UnavailableRateLimiter implements RateLimiter {
  async check(): Promise<never> {
    throw new Error('RATE_LIMIT_KV binding is not configured.');
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/mcp') {
      return jsonResponse({ error: 'Not found. POST JSON-RPC to /mcp.' }, 404);
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
    }

    let message: JSONRPCMessage;
    try {
      message = (await request.json()) as JSONRPCMessage;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    const identity = identityFromRequest(request.headers.get('CF-Connecting-IP') ?? undefined);
    const rateLimiter: RateLimiter = env.RATE_LIMIT_KV
      ? new KvRateLimiter(env.RATE_LIMIT_KV)
      : new UnavailableRateLimiter();

    const server = createServer({ rateLimiter, env, identity });
    const transport = new FetchTransport();
    await server.connect(transport);

    try {
      const responses = await transport.handleMessage(message);
      if (responses.length === 0) {
        // Notification — no response body expected.
        return new Response(null, { status: 202 });
      }
      return jsonResponse(responses.length === 1 ? responses[0] : responses, 200);
    } catch (error) {
      console.error('[mcp-worker] request failed:', error instanceof Error ? error.message : error);
      return jsonResponse({ error: 'Internal error.' }, 500);
    } finally {
      await server.close();
    }
  },
};
