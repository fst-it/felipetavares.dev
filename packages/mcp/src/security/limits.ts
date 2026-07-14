/**
 * Rate-limit and circuit-breaker numbers for every tool class (MCP commit 2). Single definition —
 * shell.ts, stdio.ts, and worker.ts all read these, no tool re-declares its own numbers.
 *
 * Per-identity limits use the existing RateLimiter port (src/core/ports/rate-limiter.ts), keyed
 * per caller identity + tool class. Global circuit breakers use the same port with a fixed,
 * identity-independent key, protecting the free-tier quotas (Workers AI / Resend) the whole
 * deployment shares regardless of who's calling.
 */

export type ToolClass = 'read' | 'search' | 'ask_felipe' | 'leave_message';

export interface LimitWindow {
  limit: number;
  windowSeconds: number;
}

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** Per-identity limits, keyed by tool class. */
export const PER_IDENTITY_LIMITS: Record<ToolClass, LimitWindow> = {
  read: { limit: 60, windowSeconds: HOUR },
  search: { limit: 30, windowSeconds: HOUR },
  ask_felipe: { limit: 10, windowSeconds: HOUR },
  leave_message: { limit: 3, windowSeconds: DAY },
};

/**
 * Global daily circuit breakers — only defined for the two tool classes with a real per-request
 * cost (an LLM call; an outbound email), protecting shared free-tier quotas irrespective of which
 * identity is calling. Overridable via env so a deployment can tune them without a code change:
 * `MCP_ASK_FELIPE_DAILY_LIMIT`, `MCP_LEAVE_MESSAGE_DAILY_LIMIT`.
 */
export const DEFAULT_GLOBAL_DAILY_LIMITS: Partial<Record<ToolClass, number>> = {
  ask_felipe: 200,
  leave_message: 20,
};

export interface DailyLimitEnv {
  MCP_ASK_FELIPE_DAILY_LIMIT?: string;
  MCP_LEAVE_MESSAGE_DAILY_LIMIT?: string;
}

export function globalDailyLimit(toolClass: ToolClass, env: DailyLimitEnv = {}): number | undefined {
  if (toolClass === 'ask_felipe') {
    const override = env.MCP_ASK_FELIPE_DAILY_LIMIT;
    return override ? Number(override) : DEFAULT_GLOBAL_DAILY_LIMITS.ask_felipe;
  }
  if (toolClass === 'leave_message') {
    const override = env.MCP_LEAVE_MESSAGE_DAILY_LIMIT;
    return override ? Number(override) : DEFAULT_GLOBAL_DAILY_LIMITS.leave_message;
  }
  return undefined;
}

/** Fail-open (allow on limiter backend error) for cheap deterministic reads/search; fail-closed
 *  (deny on limiter backend error) for anything that spends real money/quota or sends mail. */
export function failsOpen(toolClass: ToolClass): boolean {
  return toolClass === 'read' || toolClass === 'search';
}
