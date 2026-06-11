import { describe, expect, it } from 'vitest';
import { type ConfirmDeps, confirmEmailToken } from '../confirm';
import { generateToken, hashToken, type VerificationRecord } from '../token';

// Task 3.6 (confirm half) — atomic single-use email confirmation.
// The DB's UPDATE ... WHERE status='pending' AND expires_at > now() is the
// source of truth for single-use atomicity; this decision wrapper turns the
// flip outcome (+ a diagnostic load) into a typed result for the route.

const NOW = new Date('2026-06-11T12:00:00.000Z');

function pendingRecord(tokenHash: string, expiresAt: Date): VerificationRecord {
  return { tokenHash, status: 'pending', expiresAt };
}

describe('confirmEmailToken', () => {
  it('returns "valid" when the atomic flip succeeds', async () => {
    const { token, tokenHash } = generateToken({ now: NOW });
    let flippedWith: string | undefined;
    const deps: ConfirmDeps = {
      now: NOW,
      atomicConfirm: async (h) => {
        flippedWith = h;
        return true;
      },
      loadRecord: async () => {
        throw new Error('should not load when the flip succeeds');
      },
    };

    const outcome = await confirmEmailToken(token, deps);

    expect(outcome).toBe('valid');
    expect(flippedWith).toBe(tokenHash); // looked up by token hash, never raw
  });

  it('returns "invalid" for an unknown token (flip fails, no record)', async () => {
    const deps: ConfirmDeps = {
      now: NOW,
      atomicConfirm: async () => false,
      loadRecord: async () => null,
    };
    expect(await confirmEmailToken('does-not-exist', deps)).toBe('invalid');
  });

  it('returns "expired" when the flip fails because the row is past expiry', async () => {
    const { token } = generateToken({ now: NOW });
    const past = new Date(NOW.getTime() - 60_000);
    const deps: ConfirmDeps = {
      now: NOW,
      atomicConfirm: async () => false,
      loadRecord: async () => pendingRecord(hashToken(token), past),
    };
    expect(await confirmEmailToken(token, deps)).toBe('expired');
  });

  it('returns "already_used" when the row is no longer pending', async () => {
    const { token } = generateToken({ now: NOW });
    const future = new Date(NOW.getTime() + 60_000);
    const deps: ConfirmDeps = {
      now: NOW,
      atomicConfirm: async () => false,
      loadRecord: async () => ({
        tokenHash: hashToken(token),
        status: 'confirmed',
        expiresAt: future,
      }),
    };
    expect(await confirmEmailToken(token, deps)).toBe('already_used');
  });

  it('resolves a lost race (flip failed but record still looks valid) to "already_used"', async () => {
    const { token } = generateToken({ now: NOW });
    const future = new Date(NOW.getTime() + 60_000);
    const deps: ConfirmDeps = {
      now: NOW,
      atomicConfirm: async () => false, // another request won the flip
      loadRecord: async () => pendingRecord(hashToken(token), future), // not yet reloaded as confirmed
    };
    expect(await confirmEmailToken(token, deps)).toBe('already_used');
  });
});
