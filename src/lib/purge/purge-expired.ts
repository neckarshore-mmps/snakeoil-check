// GDPR F-NOW-2 (Dr. Sommer baseline 2026-06-09) — Speicherbegrenzung,
// Art. 5(1)(e): checks rows carry expiresAt (+30d at persist time), but
// Postgres does not evict like Redis does. This module is the missing purge
// mechanism, run nightly via Vercel Cron (see vercel.ts `crons`).
//
// check_results rows go with their check via the FK's ON DELETE CASCADE
// (pinned in __tests__/cron-config.test.ts).
//
// Auth posture: fail CLOSED. No CRON_SECRET configured → 503 (a misconfigured
// purge endpoint must not be openly callable); wrong/missing bearer → 401.

import { and, isNotNull, lt } from 'drizzle-orm';
import type { Db } from '../../db';
import { checks } from '../../db/schema';

export interface PurgeResult {
  /** Number of checks rows deleted (check_results cascade with them). */
  deletedChecks: number;
  /** The cutoff instant used: rows with expires_at strictly before it died. */
  cutoff: string;
}

/** Delete every check whose expires_at lies strictly in the past. */
export async function purgeExpiredChecks(dbi: Db, now: Date): Promise<PurgeResult> {
  const deleted = await dbi
    .delete(checks)
    .where(and(isNotNull(checks.expiresAt), lt(checks.expiresAt, now)))
    .returning({ id: checks.id });

  return { deletedChecks: deleted.length, cutoff: now.toISOString() };
}

export interface PurgeCronDeps {
  /** The actual purge work — injected so the handler is testable without a DB. */
  purge: () => Promise<PurgeResult>;
  /** Bearer secret; defaults to env CRON_SECRET (Vercel Cron sends it). */
  secret?: string;
}

/**
 * HTTP handler for the nightly purge cron (auth + posture only; the DB work
 * lives in purgeExpiredChecks). Vercel Cron invokes the route with
 * `Authorization: Bearer ${CRON_SECRET}` when the env var is set.
 */
export async function handlePurgeCron(req: Request, deps: PurgeCronDeps): Promise<Response> {
  const secret = deps.secret ?? process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: without a configured secret the endpoint must not run.
    return Response.json({ ok: false, error: 'cron not configured' }, { status: 503 });
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await deps.purge();
    return Response.json({ ok: true, ...result });
  } catch {
    // No internal error detail in the response (connection strings, hosts).
    return Response.json({ ok: false, error: 'purge failed' }, { status: 500 });
  }
}
