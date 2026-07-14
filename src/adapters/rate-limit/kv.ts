import type { RateLimiter, RateLimitResult } from '../../core/ports/rate-limiter';

/** Minimal shape of the Cloudflare KVNamespace binding this adapter needs. */
export interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Production RateLimiter adapter backed by Cloudflare KV (spec section 11).
 * Fixed-window counter keyed by `${keyPrefix}:${key}`, TTL'd to the window.
 */
export class KvRateLimiter implements RateLimiter {
  constructor(private readonly kv: KvNamespaceLike) {}

  async check(key: string, opts: { limit: number; windowSeconds: number }): Promise<RateLimitResult> {
    const raw = await this.kv.get(key);
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= opts.limit) {
      return { allowed: false, remaining: 0 };
    }

    await this.kv.put(key, String(count + 1), { expirationTtl: opts.windowSeconds });
    return { allowed: true, remaining: opts.limit - (count + 1) };
  }
}
