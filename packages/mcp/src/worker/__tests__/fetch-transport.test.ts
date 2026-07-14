import { describe, it, expect } from 'vitest';
import { FetchTransport } from '../fetch-transport';

describe('FetchTransport', () => {
  it('feeds a request message to onmessage and resolves handleMessage once send() is called', async () => {
    const transport = new FetchTransport();
    transport.onmessage = (message) => {
      const req = message as { id: number; method: string };
      // Simulate the McpServer's eventual response for this request.
      void transport.send({ jsonrpc: '2.0', id: req.id, result: { ok: true } });
    };

    const responses = await transport.handleMessage({ jsonrpc: '2.0', id: 1, method: 'ping' } as never);
    expect(responses).toEqual([{ jsonrpc: '2.0', id: 1, result: { ok: true } }]);
  });

  it('returns an empty array for a notification (no id), without waiting for a send() call', async () => {
    const transport = new FetchTransport();
    transport.onmessage = () => {
      // A notification handler produces no response — never calls send().
    };
    const responses = await transport.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' } as never);
    expect(responses).toEqual([]);
  });

  it('rejects if no send() call happens before the timeout', async () => {
    const transport = new FetchTransport();
    transport.onmessage = () => {
      // Deliberately never calls send() — simulates a hung handler.
    };
    await expect(
      transport.handleMessage({ jsonrpc: '2.0', id: 1, method: 'ping' } as never, 50)
    ).rejects.toThrow('timed out');
  });

  it('start() and close() resolve without throwing', async () => {
    const transport = new FetchTransport();
    await expect(transport.start()).resolves.toBeUndefined();
    await expect(transport.close()).resolves.toBeUndefined();
  });

  it('invokes onclose when close() is called', async () => {
    const transport = new FetchTransport();
    let closed = false;
    transport.onclose = () => {
      closed = true;
    };
    await transport.close();
    expect(closed).toBe(true);
  });
});
