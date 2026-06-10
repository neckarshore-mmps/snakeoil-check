import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canConfirm,
  generateToken,
  hashToken,
  isTokenExpired,
  TOKEN_TTL_MS,
  tokenExpiresAt,
  verifyToken,
} from '../token';

// Email-confirm token flow: generate (random + sha256), verify (timing-safe),
// 30-min TTL, and single-use (a token can be confirmed only while pending).

describe('generateToken', () => {
  it('returns a url-safe token and its sha256 hash', () => {
    const { token, tokenHash } = generateToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url: no +, /, or = padding
    expect(token).toHaveLength(43); // 32 random bytes -> 43 base64url chars
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(tokenHash).toHaveLength(64);
  });

  it('produces a unique token on each call', () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});

describe('verifyToken', () => {
  it('returns true when the token matches the stored hash', () => {
    const { token, tokenHash } = generateToken();
    expect(verifyToken(token, tokenHash)).toBe(true);
  });

  it('returns false on a mismatched token', () => {
    const { tokenHash } = generateToken();
    expect(verifyToken('not-the-token', tokenHash)).toBe(false);
  });

  it('returns false (never throws) when the stored hash is malformed', () => {
    const { token } = generateToken();
    expect(verifyToken(token, 'deadbeef')).toBe(false);
  });

  it('hashToken reproduces the hash embedded by generateToken', () => {
    const { token, tokenHash } = generateToken();
    expect(hashToken(token)).toBe(tokenHash);
  });
});

describe('token expiry (30-min TTL)', () => {
  it('TOKEN_TTL_MS is 30 minutes', () => {
    expect(TOKEN_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('tokenExpiresAt is 30 minutes after the issue time', () => {
    const issued = new Date('2026-06-10T12:00:00Z');
    expect(tokenExpiresAt(issued).toISOString()).toBe('2026-06-10T12:30:00.000Z');
  });

  it('is not expired before the TTL elapses', () => {
    const expiresAt = new Date('2026-06-10T12:30:00Z');
    expect(isTokenExpired(expiresAt, new Date('2026-06-10T12:29:59Z'))).toBe(false);
  });

  it('is expired once the TTL has elapsed', () => {
    const expiresAt = new Date('2026-06-10T12:30:00Z');
    expect(isTokenExpired(expiresAt, new Date('2026-06-10T12:30:01Z'))).toBe(true);
  });
});

describe('canConfirm (single-use guard)', () => {
  const future = new Date('2026-06-10T12:30:00Z');
  const now = new Date('2026-06-10T12:00:00Z');

  it('allows confirming a pending, unexpired verification', () => {
    expect(canConfirm('pending', future, now)).toBe(true);
  });

  it('rejects a second confirm — already confirmed (single-use)', () => {
    expect(canConfirm('confirmed', future, now)).toBe(false);
  });

  it('rejects confirming an expired token even if still pending', () => {
    const past = new Date('2026-06-10T11:00:00Z');
    expect(canConfirm('pending', past, now)).toBe(false);
  });

  it('rejects bounced and expired statuses', () => {
    expect(canConfirm('bounced', future, now)).toBe(false);
    expect(canConfirm('expired', future, now)).toBe(false);
  });
});
