/**
 * Security shell (MCP commit 2) — one composable middleware wrapping every tool handler, per
 * docs/mcp.md's security model. Enforces, in order:
 *
 *   1. Per-identity rate limit (src/core/ports/rate-limiter.ts port; PER_IDENTITY_LIMITS per class).
 *   2. Global daily circuit breaker (ask_felipe / leave_message only — protects shared free-tier
 *      quotas regardless of which identity is calling).
 *
 * Fail-open vs fail-closed (limits.ts's `failsOpen`): if the RateLimiter backend itself throws
 * (e.g. a KV outage), deterministic reads/search still serve the request (fail-open — a rate-limit
 * outage shouldn't take down a free, cheap, side-effect-free tool); ask_felipe and leave_message
 * deny the request instead (fail-closed — an LLM call or an outbound email is real cost/exposure,
 * so an unknown limiter state must not silently permit it).
 *
 * Error messages returned to the caller are deliberately generic — no stack traces, no binding
 * names, no internal identifiers — matching the non-leaky-error requirement. Logging (console.error
 * only, server-side) never includes message bodies or any caller-supplied free text, only the tool
 * name/class and identity key already used for rate-limit bucketing.
 */
import type { RateLimiter } from '../../../../src/core/ports/rate-limiter';
import { PER_IDENTITY_LIMITS, globalDailyLimit, failsOpen, type ToolClass, type DailyLimitEnv } from './limits';

const GENERIC_DENIED_MESSAGE = 'Rate limit exceeded. Please try again later.';
const GENERIC_UNAVAILABLE_MESSAGE = 'This tool is temporarily unavailable. Please try again shortly.';

export interface SecurityShellDeps {
  rateLimiter: RateLimiter;
  /** Env-like map for reading global daily limit overrides (MCP_ASK_FELIPE_DAILY_LIMIT etc). */
  env?: DailyLimitEnv;
}

export interface ShellResult<T> {
  ok: boolean;
  /** Present when ok is false — always a generic, non-leaky message safe to return to the caller. */
  error?: string;
  data?: T;
}

/**
 * Wraps a tool handler with the rate-limit + circuit-breaker checks. `toolName` is used only for
 * the per-identity rate-limit key namespace (e.g. "ask_felipe:hour:<identity>") and for the (body-
 * free) log line — never logged with any request content.
 */
export async function withSecurityShell<T>(
  deps: SecurityShellDeps,
  toolName: string,
  toolClass: ToolClass,
  identity: string,
  handler: () => Promise<T>
): Promise<ShellResult<T>> {
  const perIdentity = PER_IDENTITY_LIMITS[toolClass];
  const dailyLimit = globalDailyLimit(toolClass, deps.env);

  try {
    const identityCheck = await deps.rateLimiter.check(`mcp:${toolName}:${identity}`, perIdentity);
    if (!identityCheck.allowed) {
      console.error(`[mcp-shell] ${toolName}: per-identity rate limit exceeded (identity=${identity})`);
      return { ok: false, error: GENERIC_DENIED_MESSAGE };
    }

    if (dailyLimit !== undefined) {
      const globalCheck = await deps.rateLimiter.check(`mcp:${toolName}:global-daily`, {
        limit: dailyLimit,
        windowSeconds: 24 * 60 * 60,
      });
      if (!globalCheck.allowed) {
        console.error(`[mcp-shell] ${toolName}: global daily circuit breaker tripped`);
        return { ok: false, error: GENERIC_UNAVAILABLE_MESSAGE };
      }
    }
  } catch (error) {
    console.error(`[mcp-shell] ${toolName}: rate limiter backend error`, error instanceof Error ? error.message : error);
    if (!failsOpen(toolClass)) {
      // Fail-CLOSED: an LLM call or an outbound email must not proceed on an unknown limiter state.
      return { ok: false, error: GENERIC_UNAVAILABLE_MESSAGE };
    }
    // Fail-OPEN: a cheap deterministic read/search still gets served even if the limiter itself is down.
  }

  try {
    const data = await handler();
    return { ok: true, data };
  } catch (error) {
    console.error(`[mcp-shell] ${toolName}: handler error`, error instanceof Error ? error.message : error);
    return { ok: false, error: GENERIC_UNAVAILABLE_MESSAGE };
  }
}
