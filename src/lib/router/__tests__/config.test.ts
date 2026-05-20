import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadRouterConfig } from '../config';

describe('Router Config Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set valid defaults for all vars so individual tests only override what they need
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5';
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5';
    process.env.ROUTER_FREESHOT_PROVIDER = 'google';
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-2.0-flash';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads tier-1 config from env vars', () => {
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5';

    const config = loadRouterConfig();

    expect(config.tier1).toEqual({
      provider: 'anthropic',
      model_id: 'claude-haiku-4.5',
    });
  });

  it('loads tier-2 config from env vars', () => {
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5';

    const config = loadRouterConfig();

    expect(config.tier2).toEqual({
      provider: 'anthropic',
      model_id: 'claude-sonnet-4.5',
    });
  });

  it('loads free-shot config from env vars', () => {
    process.env.ROUTER_FREESHOT_PROVIDER = 'google';
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-3-flash';

    const config = loadRouterConfig();

    expect(config.freeshot).toEqual({
      provider: 'google',
      model_id: 'gemini-3-flash',
    });
  });

  it('throws if required env var missing', () => {
    delete process.env.ROUTER_TIER1_PROVIDER;

    expect(() => loadRouterConfig()).toThrow(/ROUTER_TIER1_PROVIDER/);
  });

  it('throws if provider value is invalid', () => {
    process.env.ROUTER_TIER1_PROVIDER = 'invalid-provider';
    process.env.ROUTER_TIER1_MODEL = 'whatever';

    expect(() => loadRouterConfig()).toThrow(/invalid provider/i);
  });
});
