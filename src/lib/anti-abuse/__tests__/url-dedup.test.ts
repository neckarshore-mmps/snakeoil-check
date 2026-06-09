import { beforeEach, describe, expect, it } from 'vitest';
import {
  lookupUrlDedup,
  normalizeUrl,
  storeUrlDedup,
  URL_DEDUP_TTL_SECONDS,
  urlDedupKey,
} from '../url-dedup';
import { FakeRedis } from './fake-redis';

// Anti-Abuse Layer 5 (Design-Doc § 7.5) — 5-minute URL-dedup cache.
// Same URL re-submitted inside the window returns the cached result instead of
// triggering a fresh (paid-tier-quota-consuming) Workflow.

describe('normalizeUrl', () => {
  it('strips a trailing slash', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe(
      normalizeUrl('https://example.com/path'),
    );
  });

  it('strips the URL fragment', () => {
    expect(normalizeUrl('https://example.com/p#section')).toBe('https://example.com/p');
  });

  it('lowercases the host', () => {
    expect(normalizeUrl('https://EXAMPLE.com/p')).toBe('https://example.com/p');
  });

  it('preserves the query string (it changes the target)', () => {
    expect(normalizeUrl('https://example.com/p?ref=abc')).toContain('?ref=abc');
  });
});

describe('urlDedupKey', () => {
  it('scopes the key per IP-hash and hashes the URL (anti cache-poisoning, no PII)', () => {
    const url = 'https://example.com/offer';
    const key = urlDedupKey({ url, ipHash: 'iphash1' });

    expect(key).toMatch(/^freeshot:url:iphash1:/);
    expect(key).not.toContain('example.com');
    // normalised: trailing slash + fragment do not change the key
    expect(urlDedupKey({ url: 'https://example.com/offer/#x', ipHash: 'iphash1' })).toBe(key);
    // different IP → different cache bucket (one user cannot poison another's)
    expect(urlDedupKey({ url, ipHash: 'iphash2' })).not.toBe(key);
  });
});

describe('lookupUrlDedup / storeUrlDedup (anti-abuse Layer 5)', () => {
  let store: FakeRedis;
  const KEY = 'freeshot:url:iphash1:abc';
  const RESULT = { tendency: 'red', score: 42 };

  beforeEach(() => {
    store = new FakeRedis();
  });

  it('returns the cached result for the same URL within the window', async () => {
    await storeUrlDedup(store, KEY, RESULT);
    const cached = await lookupUrlDedup<typeof RESULT>(store, KEY);
    expect(cached).toEqual(RESULT);
  });

  it('returns null after the 5-minute window expires (fresh Workflow)', async () => {
    await storeUrlDedup(store, KEY, RESULT);
    store.advance(URL_DEDUP_TTL_SECONDS * 1000 + 1);
    expect(await lookupUrlDedup(store, KEY)).toBeNull();
  });

  it('returns null on a cache miss', async () => {
    expect(await lookupUrlDedup(store, KEY)).toBeNull();
  });

  it('defaults to a 300s (5min) TTL', async () => {
    expect(URL_DEDUP_TTL_SECONDS).toBe(300);
    await storeUrlDedup(store, KEY, RESULT);
    const ttl = await store.pttl(KEY);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(URL_DEDUP_TTL_SECONDS * 1000);
  });

  it('fails OPEN on store errors (lookup → cache miss, store → swallowed)', async () => {
    store.failMode = true;
    await expect(lookupUrlDedup(store, KEY)).resolves.toBeNull();
    await expect(storeUrlDedup(store, KEY, RESULT)).resolves.toBeUndefined();
  });
});
