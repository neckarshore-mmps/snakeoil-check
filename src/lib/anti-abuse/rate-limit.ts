// Anti-Abuse Layer 2 — fixed-window rate limit, Upstash-Redis-backed.
//
// A free public funnel: the posture is fail-OPEN. If Upstash is unreachable we
// degrade to "allow" rather than deny legit users during an infra hiccup — the
// kill-switch (Layer 4) is the fail-CLOSED cost-guard, not this layer.
// (Posture is a security decision — see report for James.)

import { pseudonymizeHash } from '../pseudonymize';
import type { RedisLike } from './redis';

/** Free-Shot default: max 3 signups per 24h per identity (IP / cookie). */
export const FREE_SHOT_RATE_LIMIT = { limit: 3, windowSeconds: 86_400 } as const;

export interface RateLimitOptions {
  /** Max allowed hits within the window before blocking. */
  limit: number;
  /** Window length in whole seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** True once the count has exceeded `limit` within the window. */
  blocked: boolean;
  /** Running count in the current window (after this hit; 0 when degraded). */
  count: number;
  /** The configured limit, echoed for callers building error messages. */
  limit: number;
  /** Seconds until the window resets — present only when blocked. */
  retryAfterSeconds?: number;
  /** True when the store was unreachable and the layer failed open. */
  degraded?: boolean;
}

/**
 * Build a namespaced, hashed rate-limit key. The raw value (e.g. an IP) is
 * HMAC-SHA256'd with HASH_SECRET (GDPR F-NOW-1), so only a keyed,
 * PSEUDONYMOUS digest lands in Redis. This is pseudonymization
 * (data-minimisation), NOT anonymization — the digest remains personal data.
 */
export function rateLimitKey(kind: string, value: string): string {
  return `freeshot:rl:${kind}:${pseudonymizeHash(value)}`;
}

/**
 * Increment and test a fixed-window counter.
 *
 * TTL is applied on the first hit, and re-applied if a key is found with a
 * count but no TTL — recovering keys orphaned by a crash between INCR and
 * EXPIRE (otherwise such a key would block its identity forever).
 */
export async function checkRateLimit(
  store: RedisLike,
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = opts;

  try {
    const count = await store.incr(key);
    let ttlMs = await store.pttl(key);

    // First hit, or an orphaned key with no TTL → (re)bound the window.
    if (count === 1 || ttlMs < 0) {
      await store.expire(key, windowSeconds);
      ttlMs = windowSeconds * 1000;
    }

    const blocked = count > limit;
    return {
      blocked,
      count,
      limit,
      retryAfterSeconds: blocked ? Math.ceil(ttlMs / 1000) : undefined,
    };
  } catch {
    // Fail open: a Redis outage must not lock out legitimate users.
    return { blocked: false, count: 0, limit, degraded: true };
  }
}
