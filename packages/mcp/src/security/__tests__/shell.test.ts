import { describe, it, expect, vi } from 'vitest';
import { withSecurityShell } from '../shell';
import type { RateLimiter } from '../../../../../src/core/ports/rate-limiter';

function allowingLimiter(): RateLimiter {
  return { check: vi.fn().mockResolvedValue({ allowed: true, remaining: 1 }) };
}

function denyingLimiter(): RateLimiter {
  return { check: vi.fn().mockResolvedValue({ allowed: false, remaining: 0 }) };
}

function throwingLimiter(message = 'simulated backend outage'): RateLimiter {
  return { check: vi.fn().mockRejectedValue(new Error(message)) };
}

describe('withSecurityShell', () => {
  it('runs the handler and returns its result when the rate limiter allows', async () => {
    const handler = vi.fn().mockResolvedValue({ hello: 'world' });
    const result = await withSecurityShell({ rateLimiter: allowingLimiter() }, 'get_cv', 'read', 'id-1', handler);
    expect(result).toEqual({ ok: true, data: { hello: 'world' } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('denies the call (without running the handler) when the per-identity limiter denies', async () => {
    const handler = vi.fn();
    const result = await withSecurityShell({ rateLimiter: denyingLimiter() }, 'ask_felipe', 'ask_felipe', 'id-1', handler);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Rate limit exceeded. Please try again later.');
    expect(handler).not.toHaveBeenCalled();
  });

  it('checks the per-identity key namespaced by tool name and identity', async () => {
    const limiter = allowingLimiter();
    await withSecurityShell({ rateLimiter: limiter }, 'search_content', 'search', 'id-42', async () => 'ok');
    expect(limiter.check).toHaveBeenCalledWith('mcp:search_content:id-42', { limit: 30, windowSeconds: 3600 });
  });

  it('also checks a global daily circuit-breaker key for ask_felipe (identity-independent)', async () => {
    const limiter = allowingLimiter();
    await withSecurityShell({ rateLimiter: limiter }, 'ask_felipe', 'ask_felipe', 'id-1', async () => 'ok');
    expect(limiter.check).toHaveBeenCalledWith('mcp:ask_felipe:global-daily', { limit: 200, windowSeconds: 86400 });
  });

  it('does not check a global daily key for read/search tool classes', async () => {
    const limiter = allowingLimiter();
    await withSecurityShell({ rateLimiter: limiter }, 'get_cv', 'read', 'id-1', async () => 'ok');
    expect(limiter.check).toHaveBeenCalledTimes(1); // per-identity only, no global-daily call
  });

  it('denies when the global daily circuit breaker itself is tripped, even if per-identity passes', async () => {
    const limiter: RateLimiter = {
      check: vi
        .fn()
        .mockResolvedValueOnce({ allowed: true, remaining: 1 }) // per-identity check passes
        .mockResolvedValueOnce({ allowed: false, remaining: 0 }), // global-daily check fails
    };
    const handler = vi.fn();
    const result = await withSecurityShell({ rateLimiter: limiter }, 'leave_message', 'leave_message', 'id-1', handler);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('This tool is temporarily unavailable. Please try again shortly.');
    expect(handler).not.toHaveBeenCalled();
  });

  describe('fail-open vs fail-closed on limiter backend errors', () => {
    it('fails OPEN (still runs the handler) for a "read" tool class', async () => {
      const handler = vi.fn().mockResolvedValue('data');
      const result = await withSecurityShell({ rateLimiter: throwingLimiter() }, 'get_cv', 'read', 'id-1', handler);
      expect(result).toEqual({ ok: true, data: 'data' });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('fails OPEN for a "search" tool class', async () => {
      const handler = vi.fn().mockResolvedValue('data');
      const result = await withSecurityShell({ rateLimiter: throwingLimiter() }, 'search_content', 'search', 'id-1', handler);
      expect(result.ok).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('fails CLOSED (never runs the handler) for "ask_felipe"', async () => {
      const handler = vi.fn();
      const result = await withSecurityShell({ rateLimiter: throwingLimiter() }, 'ask_felipe', 'ask_felipe', 'id-1', handler);
      expect(result.ok).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('fails CLOSED for "leave_message"', async () => {
      const handler = vi.fn();
      const result = await withSecurityShell({ rateLimiter: throwingLimiter() }, 'leave_message', 'leave_message', 'id-1', handler);
      expect(result.ok).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('the fail-closed error message never leaks the underlying backend error text', async () => {
      const handler = vi.fn();
      const result = await withSecurityShell(
        { rateLimiter: throwingLimiter('Cloudflare KV binding RATE_LIMIT_KV threw ECONNRESET at kv.ts:17') },
        'ask_felipe',
        'ask_felipe',
        'id-1',
        handler
      );
      expect(result.error).toBe('This tool is temporarily unavailable. Please try again shortly.');
      expect(result.error).not.toContain('KV');
      expect(result.error).not.toContain('kv.ts');
    });
  });

  describe('handler error handling', () => {
    it('returns a generic error (not the raw exception) when the handler itself throws', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('leaked internal detail: /etc/secrets'));
      const result = await withSecurityShell({ rateLimiter: allowingLimiter() }, 'get_page', 'read', 'id-1', handler);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('This tool is temporarily unavailable. Please try again shortly.');
      expect(result.error).not.toContain('/etc/secrets');
    });
  });
});
