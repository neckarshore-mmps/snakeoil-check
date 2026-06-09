import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateToken,
  generateToken,
  hashToken,
  isExpired,
  TOKEN_TTL_MINUTES,
  type VerificationRecord,
  verifyToken,
} from '../token';

// Email-Verification token flow. Pure crypto + a pure decision function: the
// atomic single-use DB flip (UPDATE ... WHERE status='pending') lives in the
// confirm route (Task 3.6) + e2e tier; `evaluateToken` encodes the rules that
// flip enforces (match -> still-pending -> not-expired) so they're unit-testable
// without a database.

describe('generateToken', () => {
  it('returns a 32-byte url-safe base64 token + its sha256 hash', () => {
    const { token, tokenHash } = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // base64url of 32 bytes, no +/=
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('sets expiry 30 minutes ahead by default', () => {
    const now = new Date('2026-06-09T12:00:00.000Z');
    const { expiresAt } = generateToken({ now });
    expect(expiresAt.toISOString()).toBe('2026-06-09T12:30:00.000Z');
    expect(TOKEN_TTL_MINUTES).toBe(30);
  });

  it('generates a unique token on each call', () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});

describe('hashToken', () => {
  it('is the sha256 hex of the token (matches generateToken)', () => {
    const { token, tokenHash } = generateToken();
    expect(hashToken(token)).toBe(tokenHash);
  });
});

describe('verifyToken', () => {
  it('returns true when the token matches the stored hash', () => {
    const { token, tokenHash } = generateToken();
    expect(verifyToken(token, tokenHash)).toBe(true);
  });

  it('returns false on a mismatched token', () => {
    const { tokenHash } = generateToken();
    expect(verifyToken('a-different-token', tokenHash)).toBe(false);
  });

  it('returns false on a malformed stored hash without throwing', () => {
    expect(verifyToken('whatever', 'not-a-valid-hex-hash')).toBe(false);
  });
});

describe('isExpired', () => {
  const expiresAt = new Date('2026-06-09T12:30:00.000Z');
  it('is false before expiry', () => {
    expect(isExpired(expiresAt, new Date('2026-06-09T12:29:59.000Z'))).toBe(false);
  });
  it('is true after expiry', () => {
    expect(isExpired(expiresAt, new Date('2026-06-09T12:30:01.000Z'))).toBe(true);
  });
});

describe('evaluateToken — single-use + expiry decision', () => {
  const now = new Date('2026-06-09T12:00:00.000Z');
  const make = (over: Partial<VerificationRecord> = {}) => {
    const { token, tokenHash } = generateToken({ now });
    const record: VerificationRecord = {
      tokenHash,
      status: 'pending',
      expiresAt: new Date('2026-06-09T12:30:00.000Z'),
      ...over,
    };
    return { token, record };
  };

  it('returns valid for a pending, unexpired, matching token', () => {
    const { token, record } = make();
    expect(evaluateToken(record, token, now)).toBe('valid');
  });

  it('returns invalid when no record is found', () => {
    expect(evaluateToken(null, 'anything', now)).toBe('invalid');
  });

  it('returns invalid when the token does not match the stored hash', () => {
    const { record } = make();
    expect(evaluateToken(record, 'wrong-token', now)).toBe('invalid');
  });

  it('returns already_used when the row is no longer pending (single-use)', () => {
    const { token, record } = make({ status: 'confirmed' });
    expect(evaluateToken(record, token, now)).toBe('already_used');
  });

  it('returns expired when now is past expires_at', () => {
    const { token, record } = make();
    expect(evaluateToken(record, token, new Date('2026-06-09T12:30:01.000Z'))).toBe('expired');
  });
});
