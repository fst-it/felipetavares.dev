#!/usr/bin/env node
/**
 * stdio entry point — what runs via `npx felipetavares-mcp` or a local MCP client config
 * (Claude Desktop/Code). Deterministic tools always work with zero credentials (content-loader.ts
 * reads disk, search reads the committed chat-chunks.json); `ask_felipe` and `leave_message`
 * degrade to the same zero-credential dev adapters the site itself uses (EchoDevProvider,
 * ConsoleEmailSender) unless ANTHROPIC_API_KEY / RESEND_API_KEY are set in the environment.
 *
 * Rate limiting: stdio is inherently single-tenant (one local process serving one MCP client), so
 * it uses the in-memory RateLimiter adapter (src/adapters/rate-limit/in-memory.ts, the same class
 * /api/chat and /api/contact fall back to in dev) with a fixed identity — counters reset when the
 * process restarts, which matches a CLI tool's natural trust boundary.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InMemoryRateLimiter } from '../../../src/adapters/rate-limit/in-memory.js';
import { createServer } from './server.js';
import { getStdioEnv } from './config.js';
import { STDIO_IDENTITY } from './security/identity.js';

async function main() {
  const server = createServer({
    rateLimiter: new InMemoryRateLimiter(),
    env: getStdioEnv(),
    identity: STDIO_IDENTITY,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[felipetavares-mcp] running via stdio');
}

main().catch((error) => {
  console.error('[felipetavares-mcp] fatal error:', error);
  process.exit(1);
});
