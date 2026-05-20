import { describe, expect, it } from 'vitest';
import { decidePath } from '../path';
import type { RouteContext } from '../types';

describe('decidePath', () => {
  it('returns gateway for anonymous free-shot', () => {
    const ctx: RouteContext = { tier: 'free-shot' };
    expect(decidePath(ctx)).toBe('gateway');
  });

  it('returns gateway for anonymous standard single-shot', () => {
    const ctx: RouteContext = { tier: 'standard' };
    expect(decidePath(ctx)).toBe('gateway');
  });

  it('returns gateway for anonymous deep single-shot', () => {
    const ctx: RouteContext = { tier: 'deep' };
    expect(decidePath(ctx)).toBe('gateway');
  });

  it('returns gateway for sub-no-byok', () => {
    const ctx: RouteContext = { tier: 'sub-no-byok', customer_id: 'user_123' };
    expect(decidePath(ctx)).toBe('gateway');
  });

  it('returns direct for sub-byok (Phase-3+)', () => {
    const ctx: RouteContext = {
      tier: 'sub-byok',
      customer_id: 'user_123',
      byok_config: {
        provider: 'anthropic',
        model_id: 'claude-opus-4.6',
        encrypted_key: 'encrypted-blob',
      },
    };
    expect(decidePath(ctx)).toBe('direct');
  });

  it('returns gateway for sub-byok tier WITHOUT byok_config (edge case)', () => {
    // Defensive: if tier is sub-byok but no config, fall back to gateway (don't crash)
    const ctx: RouteContext = { tier: 'sub-byok', customer_id: 'user_123' };
    expect(decidePath(ctx)).toBe('gateway');
  });
});
