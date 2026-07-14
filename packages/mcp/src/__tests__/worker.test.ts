import { describe, it, expect } from 'vitest';
import worker, { type WorkerEnv } from '../worker';
import type { KvNamespaceLike } from '../../../../src/adapters/rate-limit/kv';

/** In-memory fake of the Cloudflare KVNamespace binding, for testing without a real account. */
function fakeKv(): KvNamespaceLike {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function req(body: unknown): Request {
  return new Request('https://mcp.felipetavares.dev/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.1' },
    body: JSON.stringify(body),
  });
}

describe('worker fetch handler', () => {
  it('rejects a non-/mcp path with 404', async () => {
    const res = await worker.fetch(new Request('https://mcp.felipetavares.dev/other'), { RATE_LIMIT_KV: fakeKv() });
    expect(res.status).toBe(404);
  });

  it('rejects a non-POST method with 405', async () => {
    const res = await worker.fetch(new Request('https://mcp.felipetavares.dev/mcp', { method: 'GET' }), {
      RATE_LIMIT_KV: fakeKv(),
    });
    expect(res.status).toBe(405);
  });

  it('rejects invalid JSON with 400', async () => {
    const res = await worker.fetch(
      new Request('https://mcp.felipetavares.dev/mcp', { method: 'POST', body: 'not json' }),
      { RATE_LIMIT_KV: fakeKv() }
    );
    expect(res.status).toBe(400);
  });

  it('handles a real initialize -> tools/list round trip over the Fetch API', async () => {
    const env: WorkerEnv = { RATE_LIMIT_KV: fakeKv() };

    const initRes = await worker.fetch(
      req({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.1' } },
      }),
      env
    );
    expect(initRes.status).toBe(200);
    const initBody = (await initRes.json()) as { result?: { serverInfo?: { name?: string } } };
    expect(initBody.result?.serverInfo?.name).toBe('felipetavares-mcp');

    const listRes = await worker.fetch(req({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), env);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { result?: { tools?: { name: string }[] } };
    const names = listBody.result?.tools?.map((t) => t.name).sort();
    expect(names).toEqual(
      ['ask_felipe', 'get_cv', 'get_page', 'get_profile', 'leave_message', 'list_articles', 'list_projects', 'search_content'].sort()
    );
  });

  it('calls get_cv over the Worker fetch handler (no filesystem access — reads the bundled content snapshot)', async () => {
    const env: WorkerEnv = { RATE_LIMIT_KV: fakeKv() };
    const res = await worker.fetch(req({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_cv', arguments: {} } }), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result?: { structuredContent?: { basics?: { name?: string } } } };
    expect(body.result?.structuredContent?.basics?.name).toBe('Felipe Tavares');
  });

  it('calls get_page for a known project over the Worker fetch handler', async () => {
    const env: WorkerEnv = { RATE_LIMIT_KV: fakeKv() };
    const res = await worker.fetch(
      req({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_page', arguments: { path: '/projects/selfwright' } } }),
      env
    );
    const body = (await res.json()) as { result?: { structuredContent?: { markdown?: string } } };
    expect(body.result?.structuredContent?.markdown).toContain('Selfwright');
  });

  it('a notification request (no id) returns 202 with no body', async () => {
    const res = await worker.fetch(req({ jsonrpc: '2.0', method: 'notifications/initialized' }), {
      RATE_LIMIT_KV: fakeKv(),
    });
    expect(res.status).toBe(202);
  });

  it('derives identity from CF-Connecting-IP and rate-limits independently per IP', async () => {
    const kv = fakeKv();
    const env: WorkerEnv = { RATE_LIMIT_KV: kv, MCP_LEAVE_MESSAGE_DAILY_LIMIT: '100' };
    const args = { senderName: 'Jane', senderContact: 'jane@example.com', message: 'hi' };

    function callFrom(ip: string, id: number) {
      return worker.fetch(
        new Request('https://mcp.felipetavares.dev/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
          body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'leave_message', arguments: args } }),
        }),
        env
      );
    }

    // Exhaust IP A's 3/day per-identity limit.
    for (let i = 0; i < 3; i++) {
      const res = await callFrom('198.51.100.1', i + 1);
      const body = (await res.json()) as { result?: { isError?: boolean } };
      expect(body.result?.isError, `call ${i + 1} from IP A`).toBeFalsy();
    }
    const fourthFromA = await callFrom('198.51.100.1', 10);
    const fourthBody = (await fourthFromA.json()) as { result?: { isError?: boolean } };
    expect(fourthBody.result?.isError).toBe(true);

    // A different IP has its own untouched bucket.
    const firstFromB = await callFrom('198.51.100.2', 11);
    const firstBodyB = (await firstFromB.json()) as { result?: { isError?: boolean } };
    expect(firstBodyB.result?.isError).toBeFalsy();
  });

  it('fails CLOSED for ask_felipe when RATE_LIMIT_KV is not bound (limiter backend unavailable)', async () => {
    const res = await worker.fetch(
      req({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ask_felipe', arguments: { question: 'hi' } } }),
      {} // no RATE_LIMIT_KV
    );
    const body = (await res.json()) as { result?: { isError?: boolean } };
    expect(body.result?.isError).toBe(true);
  });

  it('fails OPEN for get_cv when RATE_LIMIT_KV is not bound', async () => {
    const res = await worker.fetch(
      req({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_cv', arguments: {} } }),
      {} // no RATE_LIMIT_KV
    );
    const body = (await res.json()) as { result?: { isError?: boolean } };
    expect(body.result?.isError).toBeFalsy();
  });
});
