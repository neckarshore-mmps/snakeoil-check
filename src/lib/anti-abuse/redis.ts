// Anti-Abuse shared store — the inject-store seam for all Redis-backed layers.
//
// The rate-limit, url-dedup and kill-switch layers never import `@upstash/redis`
// directly. They depend on the narrow `RedisLike` structural interface below and
// receive their store as a parameter. Production wires the real Upstash client
// via `getRedis()`; tests inject an in-memory `FakeRedis`. This keeps the layers
// pure + deterministically testable without mocking the `@upstash/redis` module
// (a TDD anti-pattern — you end up asserting your own mock, not real behaviour).

import { Redis } from '@upstash/redis';

/**
 * The exact slice of the Redis command surface the anti-abuse layers use.
 * Kept minimal on purpose: the real Upstash client structurally satisfies it,
 * and a tiny `FakeRedis` test double can implement it without faking Lua.
 */
export interface RedisLike {
  /** Atomically increment the integer at `key` (creates it at 1 if absent). */
  incr(key: string): Promise<number>;
  /** Set a TTL in whole seconds. Returns 1 if applied, 0 if the key is gone. */
  expire(key: string, seconds: number): Promise<number>;
  /** Remaining TTL in ms: >=0 if set, -1 if key exists without TTL, -2 if absent. */
  pttl(key: string): Promise<number>;
  /** Read a value, JSON-deserialised. Returns null if the key is absent. */
  get<T = string>(key: string): Promise<T | null>;
  /** Write a value (JSON-serialised). `ex` = TTL in whole seconds. */
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
}

let cached: RedisLike | null = null;

/**
 * Build (and memoise) the production Upstash-backed store.
 *
 * Fails loud — like the Turnstile verifier — if the connection env vars are
 * absent, rather than silently constructing a dead client. Wrapped as a thin
 * adapter so the call sites see exactly `RedisLike`, not Upstash's overloads.
 *
 * @throws If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing.
 */
export function getRedis(): RedisLike {
  if (cached) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Missing required env vars: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN');
  }

  const client = new Redis({ url, token });
  cached = {
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds),
    pttl: (key) => client.pttl(key),
    get: (key) => client.get(key),
    set: (key, value, opts) =>
      opts?.ex != null ? client.set(key, value, { ex: opts.ex }) : client.set(key, value),
  };
  return cached;
}
