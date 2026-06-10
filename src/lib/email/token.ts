// Email-Verify token-flow — generate + hash + verify + single-use consume.
//
// Only the sha256 hash of a token is ever stored (email_verifications.token_hash);
// the raw token exists once, inside the confirm-link. Verification compares
// hashes timing-safely. consumeVerification is the pure single-use/expiry
// decision over a stored record — the route applies the returned update.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token lifetime — written to email_verifications.expires_at at issuance. */
export const TOKEN_TTL_MINUTES = 30;

export interface GeneratedToken {
  /** 32 random bytes, url-safe base64 (43 chars, unpadded) — goes in the link. */
  token: string;
  /** sha256 hex of the token — the only form persisted. */
  tokenHash: string;
}

/** Hash a raw token the way it is stored (sha256 hex). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generate a fresh confirm-token plus its storable hash. */
export function generateToken(): GeneratedToken {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/**
 * True when `token` hashes to `storedHash`. Timing-safe; malformed stored
 * hashes simply fail the comparison instead of throwing.
 */
export function verifyToken(token: string, storedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

/** Expiry timestamp for a token issued at `now` (default: current time). */
export function tokenExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + TOKEN_TTL_MINUTES * 60_000);
}

/** The slice of an email_verifications row the consume decision needs. */
export interface StoredVerification {
  tokenHash: string;
  status: 'pending' | 'confirmed' | 'bounced' | 'expired';
  expiresAt: Date;
}

export type ConsumeResult =
  | { ok: true; update: { status: 'confirmed'; confirmedAt: Date } }
  | { ok: false; reason: 'already_used' | 'expired' | 'mismatch' };

/**
 * Single-use verify decision: a token confirms its record exactly once,
 * within TTL, and only when it hashes to the stored hash. Pure — the caller
 * persists `update` (status flips pending → confirmed on first verify).
 */
export function consumeVerification(
  stored: StoredVerification,
  token: string,
  now: Date = new Date(),
): ConsumeResult {
  if (!verifyToken(token, stored.tokenHash)) {
    return { ok: false, reason: 'mismatch' };
  }
  if (stored.status !== 'pending') {
    return { ok: false, reason: 'already_used' };
  }
  if (now.getTime() > stored.expiresAt.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, update: { status: 'confirmed', confirmedAt: now } };
}
