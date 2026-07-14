/**
 * Per-caller identity for rate limiting (MCP commit 2). Transports supply this differently:
 * stdio has no network-level caller identity (one local process = one identity for the lifetime of
 * that process — the same trust model as a CLI tool run directly by its user), so it uses a fixed
 * key; the Cloudflare Worker transport (commit 3) derives it from the request's client IP, matching
 * the pattern /api/chat and /api/contact already use (src/pages/api/chat.ts's `clientAddress`).
 */
export const STDIO_IDENTITY = 'stdio-local';

export function identityFromRequest(clientIp: string | undefined): string {
  return clientIp && clientIp.length > 0 ? clientIp : 'unknown';
}
