// Anti-Abuse Layer 5 (Design-Doc § 7.5) — 5-minute URL-dedup cache.
//
// Re-submitting the same URL inside the window returns the cached scoring result
// instead of triggering a fresh Workflow (which would burn provider quota). The
// cache key is scoped per IP-hash so one client cannot poison another's cache by
// flooding dummy URLs (risk-mitigation in the plan).
//
// Posture: fail-OPEN — a store outage degrades to "cache miss" (run fresh),
// never to a hard error. The kill-switch is the fail-closed cost guard.

import { createHash } from 'node:crypto';
import type { RedisLike } from './redis';

/** Default dedup window: 5 minutes. */
export const URL_DEDUP_TTL_SECONDS = 300;

/**
 * Canonicalise a URL for cache-keying: lowercase host, drop the fragment, and
 * strip a trailing slash. Query is preserved (it changes the target). Falls
 * back to a trimmed string for inputs the URL parser rejects.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return raw.trim().toLowerCase();
  }
}

/**
 * Build a per-IP, hashed dedup key. The normalised URL is SHA-256'd (no PII /
 * target URL stored in clear), and namespaced by the caller's IP-hash bucket.
 */
export function urlDedupKey(input: { url: string; ipHash: string }): string {
  const hash = createHash('sha256').update(normalizeUrl(input.url)).digest('hex');
  return `freeshot:url:${input.ipHash}:${hash}`;
}

/**
 * Look up a cached result. Returns null on a miss — or when the store is
 * unreachable (fail-open: a Redis hiccup must not block a real check).
 */
export async function lookupUrlDedup<T>(store: RedisLike, key: string): Promise<T | null> {
  try {
    return await store.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * Cache a result for `ttlSeconds` (default 5min). Swallows store errors —
 * a failed cache write must never fail the request that produced the result.
 */
export async function storeUrlDedup(
  store: RedisLike,
  key: string,
  result: unknown,
  ttlSeconds: number = URL_DEDUP_TTL_SECONDS,
): Promise<void> {
  try {
    await store.set(key, result, { ex: ttlSeconds });
  } catch {
    // fail open — caching is best-effort
  }
}
