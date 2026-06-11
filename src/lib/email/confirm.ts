// Task 3.6 (confirm half) — atomic single-use email confirmation.
//
// The DB UPDATE is the source of truth for single-use atomicity:
//   UPDATE email_verifications
//      SET status='confirmed', confirmed_at=$now
//    WHERE token_hash=$1 AND status='pending' AND expires_at > $now
//   RETURNING id;
// It flips at most one caller from pending→confirmed. This wrapper turns the
// flip result (+ a diagnostic load when it didn't flip) into a typed outcome
// for the route, reusing the already-tested evaluateToken rules.

import { evaluateToken, hashToken, type TokenOutcome, type VerificationRecord } from './token';

export interface ConfirmDeps {
  /**
   * Run the atomic single-use flip. Returns true iff THIS call moved the row
   * from pending (and unexpired) to confirmed.
   */
  atomicConfirm: (tokenHash: string, now: Date) => Promise<boolean>;
  /** Load the row by token-hash for diagnostics when the flip didn't happen. */
  loadRecord: (tokenHash: string) => Promise<VerificationRecord | null>;
  /** Injected clock. */
  now?: Date;
}

/**
 * Decide a confirm attempt for `rawToken`. On a successful flip → 'valid'.
 * Otherwise classify why: 'invalid' (unknown), 'expired', or 'already_used'
 * (incl. a lost race where another request won the flip).
 */
export async function confirmEmailToken(
  rawToken: string,
  deps: ConfirmDeps,
): Promise<TokenOutcome> {
  const now = deps.now ?? new Date();
  const tokenHash = hashToken(rawToken);

  if (await deps.atomicConfirm(tokenHash, now)) {
    return 'valid';
  }

  // The flip failed — explain it. If the record still *looks* valid, another
  // concurrent confirm won the single-use flip → report it as already-used.
  const record = await deps.loadRecord(tokenHash);
  const outcome = evaluateToken(record, rawToken, now);
  return outcome === 'valid' ? 'already_used' : outcome;
}
