// Anti-Abuse Layer 6+7 — kill-switch + daily system quota.
//
// Layer 6 (kill-switch): FREE_SHOT_ENABLED gates the whole Free-Shot funnel.
//   Fail-CLOSED / default-off: anything other than the exact string "true"
//   means the funnel is in maintenance. The env var MUST be set in Vercel
//   before this ships to prod (see report: KILL-SWITCH-ENV-VARS).
// Layer 7 (daily quota): a system-wide cap of N Free-Shots per UTC day guards
//   against provider free-tier exhaustion (empirical Gemini-Flash 429 observed,
//   advisor catch #4 letter-e). Default N=50, override via env.
//
// Two seams (advisor catch #4): peekKillSwitch is the READ-ONLY pipeline gate;
// consumeQuota increments and is called by the Phase-5 Workflow-trigger when a
// shot actually fires — so requests that clear anti-abuse but get rejected by a
// later gate (disposable-email, GDPR, lifetime-limit) do not drain the quota.

import type { RedisLike } from './redis';

/** Default system-wide Free-Shots per UTC day (conservative MVP cap). */
export const FREE_SHOT_DAILY_DEFAULT_LIMIT = 50;

const SECONDS_PER_DAY = 86_400;

export type KillSwitchReason = 'maintenance' | 'daily_quota_exhausted';

export interface KillSwitchResult {
  blocked: boolean;
  reason?: KillSwitchReason;
  /** Current consumed count for the day (0 when blocked before the count read). */
  count: number;
  limit: number;
  /** Seconds until UTC midnight — present only when quota-blocked. */
  retryAfterSeconds?: number;
}

export interface KillSwitchOptions {
  /** Override the FREE_SHOT_ENABLED env read (mainly for tests). */
  enabled?: boolean;
  /** Override the daily limit (defaults to env / 50). */
  dailyLimit?: number;
  /** Injected clock for deterministic UTC-day keying. */
  now?: Date;
}

/** Fail-closed: only the exact string "true" enables the funnel. */
export function isFreeShotEnabled(): boolean {
  return process.env.FREE_SHOT_ENABLED === 'true';
}

/** Daily system limit from env, falling back to the conservative default. */
export function freeShotDailyLimit(): number {
  const raw = process.env.FREE_SHOT_DAILY_SYSTEM_LIMIT;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FREE_SHOT_DAILY_DEFAULT_LIMIT;
}

/** Per-UTC-day counter key, e.g. `freeshot:daily:2026-06-09`. */
export function freeShotDailyKey(now: Date): string {
  return `freeshot:daily:${now.toISOString().slice(0, 10)}`;
}

function secondsUntilUtcMidnight(now: Date): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((midnight - now.getTime()) / 1000);
}

/**
 * Read-only gate: is the Free-Shot funnel open for this request?
 *
 * Order: maintenance (env flag) wins over quota. Fails CLOSED on a store
 * outage (reason "maintenance") — if we cannot verify the quota we block, to
 * protect the provider cost cap this layer exists to defend.
 */
export async function peekKillSwitch(
  store: RedisLike,
  opts: KillSwitchOptions = {},
): Promise<KillSwitchResult> {
  const enabled = opts.enabled ?? isFreeShotEnabled();
  const limit = opts.dailyLimit ?? freeShotDailyLimit();
  const now = opts.now ?? new Date();

  if (!enabled) {
    return { blocked: true, reason: 'maintenance', count: 0, limit };
  }

  try {
    const raw = await store.get<number | string>(freeShotDailyKey(now));
    const count = raw == null ? 0 : Number(raw);
    // Corrupt counter (manual SET / key collision) coerces to NaN, and
    // `NaN >= limit` is false — that would BYPASS the cost guard for the
    // key's TTL. Throw into the catch below → fail CLOSED (James B1-P2).
    if (!Number.isFinite(count)) throw new Error('corrupt daily counter');

    if (count >= limit) {
      return {
        blocked: true,
        reason: 'daily_quota_exhausted',
        count,
        limit,
        retryAfterSeconds: secondsUntilUtcMidnight(now),
      };
    }
    return { blocked: false, count, limit };
  } catch {
    // Fail closed: cannot confirm headroom → block to protect the cost cap.
    return { blocked: true, reason: 'maintenance', count: 0, limit };
  }
}

/**
 * Reserve one Free-Shot from today's quota. Returns the new daily count.
 * Bounds the counter with a >1-day TTL so stale per-day keys self-evict.
 * Call this from the Workflow-trigger AFTER all gates pass — not from the
 * read-only pipeline check.
 */
export async function consumeQuota(store: RedisLike, opts: { now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const key = freeShotDailyKey(now);

  const count = await store.incr(key);
  const ttl = await store.pttl(key);
  if (count === 1 || ttl < 0) {
    // 25h: safely past UTC midnight; the date-stamped key is unique per day.
    await store.expire(key, SECONDS_PER_DAY + 3_600);
  }
  return count;
}
