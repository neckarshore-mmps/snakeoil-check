import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRedis } from '../redis';

// getRedis() is the production DI factory for the inject-store seam. Its only
// behaviour worth asserting (the layers cover the rest via FakeRedis) is the
// fail-loud config contract: never hand back a dead client when the connection
// env vars are absent — mirror the Turnstile verifier's loud-on-missing-secret.

describe('getRedis (anti-abuse store factory)', () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
  });

  it('throws (fails loud) when UPSTASH connection env vars are missing', () => {
    expect(() => getRedis()).toThrow(/UPSTASH_REDIS_REST_URL/);
  });
});
