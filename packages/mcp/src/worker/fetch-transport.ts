/**
 * A minimal MCP Transport (src/shared/transport.ts's `Transport` interface) bridging one Fetch API
 * Request/Response pair — what a Cloudflare Worker's `fetch` handler actually receives, unlike
 * Node's `http.IncomingMessage`/`ServerResponse`.
 *
 * Why this exists rather than the SDK's own StreamableHTTPServerTransport: that class's
 * `handleRequest(req, res, ...)` is typed and implemented directly against Node's
 * IncomingMessage/ServerResponse (confirmed by reading
 * node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js, whose own doc comment
 * says "compatibility with Node.js HTTP server") — those types don't exist in the Workers runtime,
 * which only has the Fetch API. Cloudflare's own `agents` package solves this with a Durable-Object-
 * backed adapter, but pulls in a large, unrelated peer-dependency graph (@ai-sdk/react, @tanstack/ai,
 * chat, x402, etc. — checked via `npm view agents dependencies/peerDependencies`) for a single
 * MCP-over-Workers use case this project's $0/never-bloated constraint doesn't justify.
 *
 * This transport implements the documented, minimal `Transport` contract directly: `handleFetch`
 * feeds one incoming JSON-RPC request to the server via `onmessage`, waits for the corresponding
 * `send()` call (the server calls `send()` with the response for a request, keyed by id), and
 * resolves the Worker's Response with it. Stateless by construction (spec section 1.3's
 * recommendation: "streamable HTTP using stateless JSON... simpler to scale and maintain") — no
 * session ID, no SSE stream kept open across requests, matching this deployment's $0 Workers model
 * (no Durable Object needed).
 */
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export class FetchTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private pendingResponses: JSONRPCMessage[] = [];
  private resolveResponse?: () => void;

  async start(): Promise<void> {
    // No connection setup needed — each handleFetch call is a fully self-contained round trip.
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.pendingResponses.push(message);
    this.resolveResponse?.();
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  /**
   * Feeds one request body to the connected McpServer and waits for its response message(s).
   * A single JSON-RPC request produces exactly one response message in this stateless model
   * (notifications, which produce none, are the one exception — callers check for that first).
   */
  async handleMessage(message: JSONRPCMessage, timeoutMs = 10_000): Promise<JSONRPCMessage[]> {
    this.pendingResponses = [];
    const responseReady = new Promise<void>((resolve) => {
      this.resolveResponse = resolve;
    });

    this.onmessage?.(message);

    // Notifications (no `id`) never produce a `send()` call — don't wait for one.
    const isNotification = !('id' in message);
    if (isNotification) return [];

    await Promise.race([
      responseReady,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('MCP request timed out')), timeoutMs)),
    ]);

    return this.pendingResponses;
  }
}
