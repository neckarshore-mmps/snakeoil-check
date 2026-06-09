import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeQuota,
  FREE_SHOT_DAILY_DEFAULT_LIMIT,
  freeShotDailyKey,
  freeShotDailyLimit,
  isFreeShotEnabled,
  peekKillSwitch,
} from '../kill-switch';
import { FakeRedis } from './fake-redis';

// Anti-Abuse Layer 6+7 — kill-switch (FREE_SHOT_ENABLED) + daily system quota.
// peekKillSwitch is the READ-ONLY pipeline gate; consumeQuota is the seam the
// Phase-5 Workflow-trigger calls when a shot actually fires (advisor: don't burn
// a daily slot for requests that pass anti-abuse but get rejected downstream).

const NOW = new Date('2026-06-09T12:00:00.000Z'); // 12:00 UTC → 43200s to midnight
const DAILY_KEY = 'freeshot:daily:2026-06-09';

describe('kill-switch env helpers', () => {
  const saved = process.env.FREE_SHOT_ENABLED;
  const savedLimit = process.env.FREE_SHOT_DAILY_SYSTEM_LIMIT;

  afterEach(() => {
    if (saved === undefined) delete process.env.FREE_SHOT_ENABLED;
    else process.env.FREE_SHOT_ENABLED = saved;
    if (savedLimit === undefined) delete process.env.FREE_SHOT_DAILY_SYSTEM_LIMIT;
    else process.env.FREE_SHOT_DAILY_SYSTEM_LIMIT = savedLimit;
  });

  it('isFreeShotEnabled fails closed (default off) unless FREE_SHOT_ENABLED is exactly "true"', () => {
    delete process.env.FREE_SHOT_ENABLED;
    expect(isFreeShotEnabled()).toBe(false);
    process.env.FREE_SHOT_ENABLED = 'false';
    expect(isFreeShotEnabled()).toBe(false);
    process.env.FREE_SHOT_ENABLED = 'true';
    expect(isFreeShotEnabled()).toBe(true);
  });

  it('freeShotDailyLimit defaults to 50, overridable via env', () => {
    expect(FREE_SHOT_DAILY_DEFAULT_LIMIT).toBe(50);
    delete process.env.FREE_SHOT_DAILY_SYSTEM_LIMIT;
    expect(freeShotDailyLimit()).toBe(50);
    process.env.FREE_SHOT_DAILY_SYSTEM_LIMIT = '10';
    expect(freeShotDailyLimit()).toBe(10);
  });

  it('freeShotDailyKey is derived from the UTC calendar day', () => {
    expect(freeShotDailyKey(NOW)).toBe(DAILY_KEY);
  });
});

describe('peekKillSwitch (read-only gate)', () => {
  let store: FakeRedis;

  beforeEach(() => {
    store = new FakeRedis();
  });

  it('blocks with reason "maintenance" when disabled', async () => {
    const r = await peekKillSwitch(store, { enabled: false, now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('maintenance');
  });

  it('allows when enabled and the daily count is below the limit', async () => {
    await store.set(DAILY_KEY, 49);
    const r = await peekKillSwitch(store, { enabled: true, dailyLimit: 50, now: NOW });
    expect(r.blocked).toBe(false);
    expect(r.count).toBe(49);
  });

  it('blocks with "daily_quota_exhausted" + retry-after-midnight when the limit is hit', async () => {
    await store.set(DAILY_KEY, 50);
    const r = await peekKillSwitch(store, { enabled: true, dailyLimit: 50, now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('daily_quota_exhausted');
    expect(r.retryAfterSeconds).toBe(43_200); // 12:00 UTC → midnight
  });

  it('is read-only — peeking never increments the daily counter', async () => {
    await peekKillSwitch(store, { enabled: true, dailyLimit: 50, now: NOW });
    expect(store.peek(DAILY_KEY)).toBeUndefined();
  });

  it('fails CLOSED (maintenance) when the store is unreachable — protect the cost guard', async () => {
    store.failMode = true;
    const r = await peekKillSwitch(store, { enabled: true, dailyLimit: 50, now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('maintenance');
  });
});

describe('consumeQuota (Phase-5 Workflow-trigger seam)', () => {
  let store: FakeRedis;

  beforeEach(() => {
    store = new FakeRedis();
  });

  it('increments the UTC daily counter idempotently', async () => {
    expect(await consumeQuota(store, { now: NOW })).toBe(1);
    expect(await consumeQuota(store, { now: NOW })).toBe(2);
    expect(store.peek(DAILY_KEY)?.value).toBe(2);
  });

  it('bounds the daily counter with a TTL (no eternal key)', async () => {
    await consumeQuota(store, { now: NOW });
    expect(await store.pttl(DAILY_KEY)).toBeGreaterThan(0);
  });
});
