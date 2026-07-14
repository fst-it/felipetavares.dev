export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Backs API rate limiting (contact 5/hr/IP per spec section 11; chat 20/hr/IP later).
 * `keyPrefix` namespaces separate limits (e.g. "contact", "chat") sharing one KV store.
 */
export interface RateLimiter {
  check(key: string, opts: { limit: number; windowSeconds: number }): Promise<RateLimitResult>;
}
