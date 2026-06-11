// Drizzle-backed DB ops for the email-verification flow (Tasks 3.5 + 3.6).
//
// Thin persistence layer — the decision logic lives in send-confirm.ts /
// confirm.ts / bounce-handler.ts (all unit-tested against injected fakes).
// These functions are DB-bound and exercised by the live e2e tier, not CI
// units (same convention as workflow/steps/persist.ts).

import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db';
import { emailVerifications } from '../../db/schema';
import type { VerificationInsert } from './send-confirm';
import type { VerificationRecord } from './token';

/** Insert a pending verification row (status defaults to 'pending'). */
export async function insertVerification(row: VerificationInsert): Promise<void> {
  await db.insert(emailVerifications).values({
    emailHash: row.emailHash,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
  });
}

/**
 * Atomic single-use confirm. Flips at most one row pending→confirmed and only
 * while still unexpired. Returns true iff this call performed the flip.
 */
export async function atomicConfirm(tokenHash: string, now: Date): Promise<boolean> {
  const flipped = await db
    .update(emailVerifications)
    .set({ status: 'confirmed', confirmedAt: now })
    .where(
      and(
        eq(emailVerifications.tokenHash, tokenHash),
        eq(emailVerifications.status, 'pending'),
        gt(emailVerifications.expiresAt, now),
      ),
    )
    .returning({ id: emailVerifications.id });
  return flipped.length === 1;
}

/** Load a verification row by token-hash for confirm diagnostics. */
export async function loadVerification(tokenHash: string): Promise<VerificationRecord | null> {
  const [row] = await db
    .select({
      tokenHash: emailVerifications.tokenHash,
      status: emailVerifications.status,
      expiresAt: emailVerifications.expiresAt,
    })
    .from(emailVerifications)
    .where(eq(emailVerifications.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

/**
 * Mark every verification row for an email-hash bounced (Layer 4). Returns the
 * number of rows touched.
 */
export async function markBounced(emailHash: string, now: Date): Promise<number> {
  const updated = await db
    .update(emailVerifications)
    .set({ status: 'bounced', bouncedAt: now })
    .where(eq(emailVerifications.emailHash, emailHash))
    .returning({ id: emailVerifications.id });
  return updated.length;
}

/** Has this email-hash been flagged bounced/complained by a prior webhook? */
export async function isEmailBlocked(emailHash: string): Promise<boolean> {
  const [row] = await db
    .select({ id: emailVerifications.id })
    .from(emailVerifications)
    .where(
      and(eq(emailVerifications.emailHash, emailHash), eq(emailVerifications.status, 'bounced')),
    )
    .limit(1);
  return row != null;
}
