import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRouteDecision } from '../index';
import type { RouteContext, RouteSignals } from '../types';

describe('makeRouteDecision (integration)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5';
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5';
    process.env.ROUTER_FREESHOT_PROVIDER = 'google';
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-3-flash';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('routes free-shot to gemini flash via gateway', () => {
    const signals: RouteSignals = {};
    const context: RouteContext = { tier: 'free-shot' };

    const decision = makeRouteDecision(signals, context);

    expect(decision).toMatchObject({
      provider: 'google',
      model_id: 'gemini-3-flash',
      path: 'gateway',
      key_source: 'shared',
      token_budget: { input_max: 10_000, output_max: 1_500 },
    });
  });

  it('routes standard tier-1 to haiku via gateway', () => {
    const signals: RouteSignals = {};
    const context: RouteContext = { tier: 'standard' };

    const decision = makeRouteDecision(signals, context);

    expect(decision).toMatchObject({
      model_tier: 1,
      provider: 'anthropic',
      model_id: 'claude-haiku-4.5',
      path: 'gateway',
      token_budget: { input_max: 30_000, output_max: 3_000 },
    });
  });

  it('routes deep tier-2 to sonnet via gateway', () => {
    const signals: RouteSignals = { customer_explicit_deep_analysis: true };
    const context: RouteContext = { tier: 'deep' };

    const decision = makeRouteDecision(signals, context);

    expect(decision).toMatchObject({
      model_tier: 2,
      provider: 'anthropic',
      model_id: 'claude-sonnet-4.5',
      path: 'gateway',
      token_budget: { input_max: 50_000, output_max: 5_000 },
    });
  });

  it('escalates standard to tier-2 on high stake', () => {
    const signals: RouteSignals = { stake_indicator: 'high' };
    const context: RouteContext = { tier: 'standard' };

    const decision = makeRouteDecision(signals, context);

    expect(decision.model_tier).toBe(2);
    expect(decision.model_id).toBe('claude-sonnet-4.5');
  });

  it('includes gateway_tags for cost-tracking', () => {
    const decision = makeRouteDecision({}, { tier: 'standard' });

    expect(decision.gateway_tags).toContain('tier:standard');
    expect(decision.gateway_tags).toContain('feature:snake-oil-check');
  });
});
