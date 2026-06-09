// Email-Verification token flow — generate / hash / verify / expiry.
//
// The raw token is mailed in the confirm-link; only its sha256 hash is stored
// (email_verifications.token_hash), so a DB leak never exposes a usable token.
// verifyToken compares in constant time. The single-use guarantee is enforced
// atomically in SQL at confirm-time (UPDATE ... WHERE status='pending'); the
// pure `evaluateToken` mirrors those rules for unit-level coverage + caller
// branching/diagnostics.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MINUTES = 30;
export const TOKEN_BYTES = 32;

export interface GeneratedToken {
  /** Raw url-safe token — goes in the confirm-link, never persisted. */
  token: string;
  /** sha256(token) hex — persisted in email_verifications.token_hash. */
  tokenHash: string;
  /** now + TTL — persisted in email_verifications.expires_at. */
  expiresAt: Date;
}

export interface GenerateTokenOptions {
  /** Injected clock for deterministic expiry in tests. */
  now?: Date;
  ttlMinutes?: number;
}

/** Minimal email_verifications projection the confirm decision needs. */
export interface VerificationRecord {
  tokenHash: string;
  /** 'pending' | 'confirmed' | 'bounced' | 'expired'. */
  status: string;
  expiresAt: Date;
}

export type TokenOutcome = 'valid' | 'invalid' | 'expired' | 'already_used';

/** sha256(token) as lowercase hex. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Mint a fresh verification token + its stored hash + expiry. */
export function generateToken(opts: GenerateTokenOptions = {}): GeneratedToken {
  const now = opts.now ?? new Date();
  const ttlMinutes = opts.ttlMinutes ?? TOKEN_TTL_MINUTES;
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  return { token, tokenHash: hashToken(token), expiresAt };
}

/**
 * Constant-time check that `token` hashes to `storedHash`. Returns false (never
 * throws) for a malformed stored hash — a non-hex value decodes to the wrong
 * byte length and fails the length guard before timingSafeEqual.
 */
export function verifyToken(token: string, storedHash: string): boolean {
  const actual = createHash('sha256').update(token).digest();
  const expected = Buffer.from(storedHash, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

/** True once `now` has reached or passed `expiresAt` (fail-closed at the instant). */
export function isExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/**
 * Decide a confirmation attempt. Mirrors the atomic SQL guard:
 *   match the hash -> still pending (single-use) -> not expired.
 * The SQL UPDATE remains the source of truth for concurrent atomicity; this is
 * the deterministic, DB-free expression of the same rules.
 */
export function evaluateToken(
  record: VerificationRecord | null,
  suppliedToken: string,
  now: Date,
): TokenOutcome {
  if (!record) return 'invalid';
  if (!verifyToken(suppliedToken, record.tokenHash)) return 'invalid';
  if (record.status !== 'pending') return 'already_used';
  if (isExpired(record.expiresAt, now)) return 'expired';
  return 'valid';
}
