// Email-confirm token flow (Layer 3 of the email validator).
//
// A token is a 32-byte random secret handed to the user via the confirm link;
// only its sha256 hash is stored (email_verifications.token_hash). Confirmation
// is single-use and time-boxed: a token may be redeemed once, while its row is
// still `pending` and within the 30-minute TTL (expires_at).

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Confirm-link lifetime — 30 minutes, mirrored into email_verifications.expires_at. */
export const TOKEN_TTL_MS = 30 * 60 * 1000;

/** Mirrors the `email_verification_status` DB enum. */
export type VerificationStatus = 'pending' | 'confirmed' | 'bounced' | 'expired';

/** sha256 hex of a token — what we persist, never the raw token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a single-use confirm token. Returns the raw token (goes into the email
 * link) and its hash (goes into the DB). The raw token is never stored.
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/**
 * Constant-time check that `token` hashes to `storedHash`. Returns false (never
 * throws) when `storedHash` is malformed, so a bad input can't crash the route.
 */
export function verifyToken(token: string, storedHash: string): boolean {
  const computed = hashToken(token);
  if (computed.length !== storedHash.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}

/** The expiry instant for a token issued at `from` (from + 30 min). */
export function tokenExpiresAt(from: Date): Date {
  return new Date(from.getTime() + TOKEN_TTL_MS);
}

/** True once `now` has reached/passed `expiresAt`. */
export function isTokenExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/**
 * Single-use guard: a verification may be confirmed only while it is still
 * `pending` and within its TTL. Any other status (already confirmed, bounced,
 * expired) or a lapsed TTL blocks the flip — enforcing one-time use.
 */
export function canConfirm(status: VerificationStatus, expiresAt: Date, now: Date): boolean {
  return status === 'pending' && !isTokenExpired(expiresAt, now);
}
