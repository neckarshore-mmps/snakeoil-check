import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  consumeVerification,
  generateToken,
  TOKEN_TTL_MINUTES,
  tokenExpiresAt,
  verifyToken,
} from '../token';

// Email-Verify token-flow — generate + hash + verify as pure crypto helpers,
// plus the single-use/expiry decision (consumeVerification) as pure logic over
// an email_verifications-shaped record. The DB write itself lives in the route.

const NOW = new Date('2026-06-10T12:00:00Z');

describe('generateToken', () => {
  it('returns a 32-byte url-safe base64 token and its sha256 hash', () => {
    const { token, tokenHash } = generateToken();

    // url-safe base64 alphabet, no padding; 32 bytes → 43 chars
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('produces a fresh token per call', () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});

describe('verifyToken', () => {
  it('matches a token against its stored hash', () => {
    const { token, tokenHash } = generateToken();
    expect(verifyToken(token, tokenHash)).toBe(true);
  });

  it('rejects a mismatching token', () => {
    const { tokenHash } = generateToken();
    expect(verifyToken(generateToken().token, tokenHash)).toBe(false);
  });

  it('rejects a malformed stored hash without throwing', () => {
    const { token } = generateToken();
    expect(verifyToken(token, 'not-a-hash')).toBe(false);
  });
});

describe('tokenExpiresAt (30min TTL → email_verifications.expires_at)', () => {
  it('expires 30 minutes after issuance', () => {
    expect(TOKEN_TTL_MINUTES).toBe(30);
    expect(tokenExpiresAt(NOW)).toEqual(new Date('2026-06-10T12:30:00Z'));
  });
});

describe('consumeVerification (single-use + expiry over a stored record)', () => {
  function record(overrides: Partial<Parameters<typeof consumeVerification>[0]> = {}) {
    const { token, tokenHash } = generateToken();
    return {
      stored: {
        tokenHash,
        status: 'pending' as const,
        expiresAt: tokenExpiresAt(NOW),
      },
      token,
      ...overrides,
    };
  }

  it('confirms a pending, unexpired token on first verify', () => {
    const { stored, token } = record();
    expect(consumeVerification(stored, token, NOW)).toEqual({
      ok: true,
      update: { status: 'confirmed', confirmedAt: NOW },
    });
  });

  it('is single-use — an already-confirmed record rejects a second verify', () => {
    const { stored, token } = record();
    const used = { ...stored, status: 'confirmed' as const };
    expect(consumeVerification(used, token, NOW)).toEqual({
      ok: false,
      reason: 'already_used',
    });
  });

  it('rejects after the 30min TTL has passed', () => {
    const { stored, token } = record();
    const later = new Date(NOW.getTime() + 31 * 60_000);
    expect(consumeVerification(stored, token, later)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects a token that does not match the stored hash', () => {
    const { stored } = record();
    const other = generateToken().token;
    expect(consumeVerification(stored, other, NOW)).toEqual({
      ok: false,
      reason: 'mismatch',
    });
  });
});
