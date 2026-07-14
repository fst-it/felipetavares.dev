/**
 * Single binding point for this package's LLM/email adapters (MCP commit 2) — mirrors
 * src/config/llm.ts's pattern exactly: pick the concrete adapter by presence/absence of a
 * credential, defaulting to a zero-credential dev fallback so every tool is fully testable without
 * any account connected.
 *
 * Both transports read credentials differently: stdio (this file's `getMcpEnv()`) reads
 * `process.env` directly (there's no Cloudflare binding outside a Worker); the Worker transport
 * (commit 3) reads `env` bindings/secrets the same way src/pages/api/chat.ts does. Both converge
 * on the same `McpEnv` shape so server.ts / the tool handlers never need to know which transport
 * is running.
 */
import type { LlmProvider } from '../../../src/core/ports/llm-provider';
import type { EmailSender } from '../../../src/core/ports/email-sender';
import { LlmRouter } from '../../../src/adapters/llm/router';
import { AnthropicProvider } from '../../../src/adapters/llm/anthropic';
import { EchoDevProvider } from '../../../src/adapters/llm/echo-dev';
import { ConsoleEmailSender } from '../../../src/adapters/email-console';
import { ResendEmailSender } from '../../../src/adapters/email-resend';

export interface McpEnv {
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  MCP_ASK_FELIPE_DAILY_LIMIT?: string;
  MCP_LEAVE_MESSAGE_DAILY_LIMIT?: string;
}

/** stdio transport's env source — real Cloudflare bindings don't exist outside a Worker, so the
 *  equivalent local credential is a plain environment variable the operator sets before running
 *  `npx felipetavares-mcp` (documented in docs/mcp.md). Absent by default: stdio runs fully
 *  zero-credential (EchoDevProvider + ConsoleEmailSender) unless explicitly configured. */
export function getStdioEnv(): McpEnv {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
    MCP_ASK_FELIPE_DAILY_LIMIT: process.env.MCP_ASK_FELIPE_DAILY_LIMIT,
    MCP_LEAVE_MESSAGE_DAILY_LIMIT: process.env.MCP_LEAVE_MESSAGE_DAILY_LIMIT,
  };
}

/**
 * Provider routing for `ask_felipe`: Anthropic (Claude Haiku) if a key is present, else the fully
 * offline EchoDevProvider — no Workers AI here (this package has no `env.AI` binding outside the
 * Worker transport in commit 3, which wires its own chain). No fallback chain needed with a single
 * candidate + the terminal echo provider; LlmRouter is still used so failure/retry semantics match
 * the site's own chat path exactly (same class, same behavior, single definition).
 */
export function getLlmProvider(env: McpEnv): LlmProvider {
  const anthropic = env.ANTHROPIC_API_KEY ? new AnthropicProvider(env.ANTHROPIC_API_KEY) : undefined;
  const echo = new EchoDevProvider();
  return new LlmRouter(anthropic ?? echo, anthropic ? [echo] : []);
}

export function getEmailSender(env: McpEnv): EmailSender {
  return env.RESEND_API_KEY ? new ResendEmailSender(env.RESEND_API_KEY) : new ConsoleEmailSender();
}
