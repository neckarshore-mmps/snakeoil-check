import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, FREE_SHOT_RATE_LIMIT, rateLimitKey } from '../rate-limit';
import { FakeRedis } from './fake-redis';

// rateLimitKey is keyed by HASH_SECRET (GDPR F-NOW-1) — provide it for the suite.
beforeAll(() => {
  vi.stubEnv('HASH_SECRET', 'test-hash-secret');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

// Anti-Abuse Layer 2 — IP+Cookie rate-limit, Upstash-backed.
// Exercised against the in-memory FakeRedis (inject-store) so these assertions
// cover REAL limiter logic + TTL behaviour, not a mocked Redis.

const OPTS = { limit: 3, windowSeconds: 86_400 } as const;

describe('rateLimitKey', () => {
  it('namespaces by kind and hashes the raw value (never stores it in clear)', () => {
    const ip = '203.0.113.7';
    const key = rateLimitKey('ip', ip);

    expect(key).toMatch(/^freeshot:rl:ip:/);
    expect(key).not.toContain(ip);
    // deterministic: same input → same key
    expect(rateLimitKey('ip', ip)).toBe(key);
    // distinct kinds for the same raw value never collide
    expect(rateLimitKey('cookie', ip)).not.toBe(key);
  });

  it('hashes are keyed (HMAC) — NOT the plain unsalted SHA-256 of the value (GDPR F-NOW-1)', () => {
    const ip = '203.0.113.7';
    const plainSha256 = createHash('sha256').update(ip).digest('hex');
    expect(rateLimitKey('ip', ip)).not.toContain(plainSha256);
  });
});

describe('checkRateLimit (anti-abuse Layer 2)', () => {
  let store: FakeRedis;
  const KEY = 'freeshot:rl:ip:abc';

  beforeEach(() => {
    store = new FakeRedis();
  });

  it('increments the counter and reports the running count', async () => {
    const first = await checkRateLimit(store, KEY, OPTS);
    expect(first.count).toBe(1);
    expect(first.blocked).toBe(false);
    expect(first.limit).toBe(3);

    const second = await checkRateLimit(store, KEY, OPTS);
    expect(second.count).toBe(2);
    expect(second.blocked).toBe(false);
  });

  it('blocks the 4th call within the window (max 3)', async () => {
    await checkRateLimit(store, KEY, OPTS);
    await checkRateLimit(store, KEY, OPTS);
    await checkRateLimit(store, KEY, OPTS);
    const fourth = await checkRateLimit(store, KEY, OPTS);

    expect(fourth.count).toBe(4);
    expect(fourth.blocked).toBe(true);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    expect(fourth.retryAfterSeconds).toBeLessThanOrEqual(OPTS.windowSeconds);
  });

  it('sets a TTL on the first hit (window is bounded, not eternal)', async () => {
    await checkRateLimit(store, KEY, OPTS);
    const ttl = await store.pttl(KEY);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(OPTS.windowSeconds * 1000);
  });

  it('recovers an orphaned key that has a count but no TTL (crash between incr and expire)', async () => {
    // Simulate a key left without a TTL by a process that died after incr.
    await store.incr(KEY);
    await store.incr(KEY);
    expect(await store.pttl(KEY)).toBe(-1); // exists, no TTL

    await checkRateLimit(store, KEY, OPTS);

    expect(await store.pttl(KEY)).toBeGreaterThan(0); // TTL re-applied
  });

  it('resets the counter after the window expires', async () => {
    await checkRateLimit(store, KEY, OPTS);
    await checkRateLimit(store, KEY, OPTS);

    store.advance(OPTS.windowSeconds * 1000 + 1); // jump past the 24h window

    const afterReset = await checkRateLimit(store, KEY, OPTS);
    expect(afterReset.count).toBe(1);
    expect(afterReset.blocked).toBe(false);
  });

  it('fails OPEN when the store is unreachable (never deny a legit user on a Redis hiccup)', async () => {
    store.failMode = true;

    const result = await checkRateLimit(store, KEY, OPTS);

    expect(result.blocked).toBe(false);
    expect(result.degraded).toBe(true);
  });

  it('exposes the Free-Shot default (3 per 24h)', () => {
    expect(FREE_SHOT_RATE_LIMIT.limit).toBe(3);
    expect(FREE_SHOT_RATE_LIMIT.windowSeconds).toBe(86_400);
  });
});
