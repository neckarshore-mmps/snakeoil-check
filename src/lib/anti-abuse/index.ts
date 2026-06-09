// Anti-Abuse pipeline (Task 2.6) — the gate fronting the Free-Shot Workflow.
//
// Order (Design-Doc § 7): turnstile → rate-limit → url-dedup → kill-switch.
// The first layer that blocks short-circuits and returns a specific HTTP status.
// url-dedup is a *cache hit*, not a block: it returns the prior result and skips
// the (quota-consuming) Workflow. The kill-switch is checked LAST and read-only
// (peek) — the actual quota consume happens at Workflow-trigger time (Phase 5).
//
// Per-layer failure posture composes here: rate-limit + url-dedup fail OPEN
// (a Redis hiccup must not lock out legit users on a free funnel), while the
// kill-switch fails CLOSED (cannot confirm cost headroom → block). Net effect
// of a full Redis outage: 503 maintenance (the cost guard wins). Posture is a
// security decision — see the session report for James.

import { createHash } from 'node:crypto';
import { peekKillSwitch } from './kill-switch';
import { checkRateLimit, FREE_SHOT_RATE_LIMIT, rateLimitKey } from './rate-limit';
import { getRedis, type RedisLike } from './redis';
import { type TurnstileVerifyResult, verifyTurnstileToken } from './turnstile';
import { lookupUrlDedup, urlDedupKey } from './url-dedup';

export interface AntiAbuseInput {
  /** The `cf-turnstile-response` token from the client widget. */
  turnstileToken: string;
  /** End-user IP (hashed before it touches Redis). */
  ip: string;
  /** Optional anti-abuse cookie id (second rate-limit dimension). */
  cookieId?: string;
  /** The URL the user wants checked. */
  url: string;
}

export interface AntiAbuseDeps {
  store: RedisLike;
  verifyTurnstile: (token: string, remoteIp?: string) => Promise<TurnstileVerifyResult>;
}

export interface AntiAbuseOptions {
  /** Injected clock (forwarded to the kill-switch for deterministic UTC keying). */
  now?: Date;
  /** Override the kill-switch daily limit (defaults to env / 50). */
  dailyLimit?: number;
}

export type AntiAbuseOutcome =
  | { outcome: 'allowed' }
  | { outcome: 'cached'; result: unknown }
  | {
      outcome: 'blocked';
      status: 403 | 429 | 503;
      layer: 'turnstile' | 'rate-limit' | 'kill-switch';
      reason: string;
      retryAfterSeconds?: number;
    };

/** SHA-256 an IP for use as a non-PII cache/bucket component. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Run the anti-abuse gate for a single Free-Shot submission.
 * Dependencies are injected so the whole pipeline is testable against a
 * FakeRedis + a stub verifier — no module mocking.
 */
export async function runAntiAbusePipeline(
  deps: AntiAbuseDeps,
  input: AntiAbuseInput,
  opts: AntiAbuseOptions = {},
): Promise<AntiAbuseOutcome> {
  const { store, verifyTurnstile } = deps;

  // 1. Turnstile (fails closed internally on network error).
  const turnstile = await verifyTurnstile(input.turnstileToken, input.ip);
  if (!turnstile.success) {
    return {
      outcome: 'blocked',
      status: 403,
      layer: 'turnstile',
      reason: turnstile.errorCodes?.join(',') || 'turnstile-failed',
    };
  }

  // 2. Rate-limit by IP, then by cookie if present (fails open).
  const ipLimit = await checkRateLimit(store, rateLimitKey('ip', input.ip), FREE_SHOT_RATE_LIMIT);
  if (ipLimit.blocked) {
    return {
      outcome: 'blocked',
      status: 429,
      layer: 'rate-limit',
      reason: 'ip',
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    };
  }
  if (input.cookieId) {
    const cookieLimit = await checkRateLimit(
      store,
      rateLimitKey('cookie', input.cookieId),
      FREE_SHOT_RATE_LIMIT,
    );
    if (cookieLimit.blocked) {
      return {
        outcome: 'blocked',
        status: 429,
        layer: 'rate-limit',
        reason: 'cookie',
        retryAfterSeconds: cookieLimit.retryAfterSeconds,
      };
    }
  }

  // 3. URL-dedup (cache hit short-circuits the Workflow; fails open → miss).
  const dedupKey = urlDedupKey({ url: input.url, ipHash: hashIp(input.ip) });
  const cached = await lookupUrlDedup<unknown>(store, dedupKey);
  if (cached != null) {
    return { outcome: 'cached', result: cached };
  }

  // 4. Kill-switch (read-only; fails closed → maintenance).
  const killSwitch = await peekKillSwitch(store, { now: opts.now, dailyLimit: opts.dailyLimit });
  if (killSwitch.blocked) {
    return {
      outcome: 'blocked',
      status: 503,
      layer: 'kill-switch',
      reason: killSwitch.reason ?? 'unavailable',
      retryAfterSeconds: killSwitch.retryAfterSeconds,
    };
  }

  return { outcome: 'allowed' };
}

/**
 * Production entry point: wires the real Upstash store + Turnstile verifier.
 * Throws (fail-loud) if the connection env vars are absent.
 */
export function runFreeShotAntiAbuse(
  input: AntiAbuseInput,
  opts: AntiAbuseOptions = {},
): Promise<AntiAbuseOutcome> {
  return runAntiAbusePipeline(
    { store: getRedis(), verifyTurnstile: verifyTurnstileToken },
    input,
    opts,
  );
}
