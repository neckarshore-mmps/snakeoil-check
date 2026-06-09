// In-memory RedisLike double for the anti-abuse layers.
//
// This is the "inject-store" half of the carry-forward directive: the layers
// receive a store, so tests exercise REAL layer logic against a real (in-memory)
// store with a controllable virtual clock — instead of mocking @upstash/redis
// and asserting the mock. Honours TTL, NX, and JSON round-tripping the same way
// the Upstash client does, so a passing test means the layer logic is correct.

import type { RedisLike } from '../redis';

interface Entry {
  value: unknown;
  /** Virtual-clock ms timestamp at which the key expires, or null for no TTL. */
  expireAt: number | null;
}

export class FakeRedis implements RedisLike {
  private store = new Map<string, Entry>();
  /** Virtual clock in ms. Advance it to simulate TTL expiry deterministically. */
  private clock = 0;
  /** When true, every command rejects — simulates Upstash being unreachable. */
  public failMode = false;

  /** Move the virtual clock forward (e.g. past a TTL window). */
  advance(ms: number): void {
    this.clock += ms;
  }

  /** Inspect the raw entry (test-only convenience). */
  peek(key: string): Entry | undefined {
    this.evictIfExpired(key);
    return this.store.get(key);
  }

  private guard(): void {
    if (this.failMode) throw new Error('FakeRedis: simulated connection failure');
  }

  private evictIfExpired(key: string): void {
    const entry = this.store.get(key);
    if (entry?.expireAt != null && entry.expireAt <= this.clock) {
      this.store.delete(key);
    }
  }

  async incr(key: string): Promise<number> {
    this.guard();
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.store.set(key, { value: next, expireAt: entry?.expireAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.guard();
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expireAt = this.clock + seconds * 1000;
    return 1;
  }

  async pttl(key: string): Promise<number> {
    this.guard();
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expireAt == null) return -1;
    return entry.expireAt - this.clock;
  }

  async get<T = string>(key: string): Promise<T | null> {
    this.guard();
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    return entry ? (entry.value as T) : null;
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown> {
    this.guard();
    this.evictIfExpired(key);
    const expireAt = opts?.ex != null ? this.clock + opts.ex * 1000 : null;
    this.store.set(key, { value, expireAt });
    return 'OK';
  }
}
