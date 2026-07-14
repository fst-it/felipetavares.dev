import type { RateLimiter, RateLimitResult } from '../../core/ports/rate-limiter';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Dev/local RateLimiter adapter — process-memory only, resets on restart.
 * Cloudflare KV (adapters/rate-limit/kv.ts) is the production adapter.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  async check(key: string, opts: { limit: number; windowSeconds: number }): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
      return { allowed: true, remaining: opts.limit - 1 };
    }

    if (existing.count >= opts.limit) {
      return { allowed: false, remaining: 0 };
    }

    existing.count += 1;
    return { allowed: true, remaining: opts.limit - existing.count };
  }
}
