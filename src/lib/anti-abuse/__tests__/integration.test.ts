import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type AntiAbuseDeps, hashIp, runAntiAbusePipeline } from '../index';
import { freeShotDailyKey } from '../kill-switch';
import { rateLimitKey } from '../rate-limit';
import type { TurnstileVerifyResult } from '../turnstile';
import { storeUrlDedup, urlDedupKey } from '../url-dedup';
import { FakeRedis } from './fake-redis';

// Anti-Abuse pipeline integration (Task 2.6): turnstile → rate-limit →
// url-dedup → kill-switch, short-circuiting on the first block. Dependencies
// (store + turnstile verifier) are INJECTED — no module mocking.

const NOW = new Date('2026-06-09T12:00:00.000Z');
const IP = '203.0.113.7';
const URL = 'https://example.com/offer';

const okTurnstile = async (): Promise<TurnstileVerifyResult> => ({ success: true });
const failTurnstile = async (): Promise<TurnstileVerifyResult> => ({
  success: false,
  errorCodes: ['timeout-or-duplicate'],
});

describe('runAntiAbusePipeline (Task 2.6 integration)', () => {
  let store: FakeRedis;
  let deps: AntiAbuseDeps;

  const saved = process.env.FREE_SHOT_ENABLED;
  const input = { turnstileToken: 'tok', ip: IP, url: URL };

  beforeEach(() => {
    store = new FakeRedis();
    deps = { store, verifyTurnstile: okTurnstile };
    process.env.FREE_SHOT_ENABLED = 'true';
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.FREE_SHOT_ENABLED;
    else process.env.FREE_SHOT_ENABLED = saved;
  });

  it('allows a clean submission through every layer', async () => {
    const r = await runAntiAbusePipeline(deps, input, { now: NOW });
    expect(r.outcome).toBe('allowed');
  });

  it('blocks (403) on a failed Turnstile and does not touch the store (short-circuit)', async () => {
    deps.verifyTurnstile = failTurnstile;

    const r = await runAntiAbusePipeline(deps, input, { now: NOW });

    expect(r).toMatchObject({ outcome: 'blocked', status: 403, layer: 'turnstile' });
    // short-circuit proof: rate-limit counter was never incremented
    expect(store.peek(rateLimitKey('ip', IP))).toBeUndefined();
  });

  it('blocks (429) once the IP exceeds the rate limit', async () => {
    await runAntiAbusePipeline(deps, input, { now: NOW });
    await runAntiAbusePipeline(deps, input, { now: NOW });
    await runAntiAbusePipeline(deps, input, { now: NOW });
    const fourth = await runAntiAbusePipeline(deps, input, { now: NOW });

    expect(fourth).toMatchObject({ outcome: 'blocked', status: 429, layer: 'rate-limit' });
    if (fourth.outcome === 'blocked') {
      expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('returns the cached result (no Workflow) for a repeat URL within the window', async () => {
    const cached = { tendency: 'red', score: 42 };
    await storeUrlDedup(store, urlDedupKey({ url: URL, ipHash: hashIp(IP) }), cached);

    const r = await runAntiAbusePipeline(deps, input, { now: NOW });

    expect(r).toMatchObject({ outcome: 'cached' });
    if (r.outcome === 'cached') expect(r.result).toEqual(cached);
  });

  it('blocks (503, maintenance) when the kill-switch is off', async () => {
    process.env.FREE_SHOT_ENABLED = 'false';

    const r = await runAntiAbusePipeline(deps, input, { now: NOW });

    expect(r).toMatchObject({ outcome: 'blocked', status: 503, reason: 'maintenance' });
  });

  it('blocks (503, daily_quota_exhausted) when the daily quota is spent', async () => {
    await store.set(freeShotDailyKey(NOW), 50);

    const r = await runAntiAbusePipeline(deps, input, { now: NOW, dailyLimit: 50 });

    expect(r).toMatchObject({ outcome: 'blocked', status: 503, reason: 'daily_quota_exhausted' });
  });

  it('composes posture on store outage: rate-limit/url-dedup degrade open, kill-switch closes', async () => {
    store.failMode = true;

    const r = await runAntiAbusePipeline(deps, input, { now: NOW });

    // turnstile passes (injected ok), rate-limit + url-dedup fail open, but the
    // kill-switch fails CLOSED → the whole pipeline blocks with 503 maintenance.
    expect(r).toMatchObject({ outcome: 'blocked', status: 503, reason: 'maintenance' });
  });
});
