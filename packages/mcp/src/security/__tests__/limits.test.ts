import { describe, it, expect } from 'vitest';
import { PER_IDENTITY_LIMITS, globalDailyLimit, failsOpen, DEFAULT_GLOBAL_DAILY_LIMITS } from '../limits';

describe('limits', () => {
  it('matches the exact per-identity numbers from the spec', () => {
    expect(PER_IDENTITY_LIMITS.read).toEqual({ limit: 60, windowSeconds: 60 * 60 });
    expect(PER_IDENTITY_LIMITS.search).toEqual({ limit: 30, windowSeconds: 60 * 60 });
    expect(PER_IDENTITY_LIMITS.ask_felipe).toEqual({ limit: 10, windowSeconds: 60 * 60 });
    expect(PER_IDENTITY_LIMITS.leave_message).toEqual({ limit: 3, windowSeconds: 24 * 60 * 60 });
  });

  it('default global daily circuit breakers match the spec (ask_felipe, leave_message: 20/day)', () => {
    expect(DEFAULT_GLOBAL_DAILY_LIMITS.leave_message).toBe(20);
    expect(typeof DEFAULT_GLOBAL_DAILY_LIMITS.ask_felipe).toBe('number');
  });

  it('read/search tool classes have no global daily circuit breaker', () => {
    expect(globalDailyLimit('read')).toBeUndefined();
    expect(globalDailyLimit('search')).toBeUndefined();
  });

  it('globalDailyLimit is overridable via env for ask_felipe and leave_message', () => {
    expect(globalDailyLimit('ask_felipe', { MCP_ASK_FELIPE_DAILY_LIMIT: '5' })).toBe(5);
    expect(globalDailyLimit('leave_message', { MCP_LEAVE_MESSAGE_DAILY_LIMIT: '1' })).toBe(1);
  });

  it('globalDailyLimit falls back to defaults when env override is absent', () => {
    expect(globalDailyLimit('leave_message', {})).toBe(20);
  });

  it('failsOpen is true only for read/search, false for ask_felipe/leave_message', () => {
    expect(failsOpen('read')).toBe(true);
    expect(failsOpen('search')).toBe(true);
    expect(failsOpen('ask_felipe')).toBe(false);
    expect(failsOpen('leave_message')).toBe(false);
  });
});
