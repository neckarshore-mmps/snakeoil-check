import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pseudonymizeHash } from '../pseudonymize';

// GDPR F-NOW-1 (Dr. Sommer baseline 2026-06-09): unsalted SHA-256 of IP/email
// is PSEUDONYMOUS personal data (Breyer C-582/14, EDPB Guidelines 01/2022) —
// an attacker with a candidate value can confirm membership by hashing it.
// Fix: HMAC-SHA256 keyed by a rotatable HASH_SECRET. These tests pin that
// contract for every identity-hash call site (email, IP, rate-limit keys).

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('pseudonymizeHash', () => {
  it('produces a 64-char lowercase hex digest', () => {
    expect(pseudonymizeHash('1.2.3.4', 'secret-1')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same value + secret', () => {
    expect(pseudonymizeHash('foo@example.com', 'secret-1')).toBe(
      pseudonymizeHash('foo@example.com', 'secret-1'),
    );
  });

  it('different values produce different digests', () => {
    expect(pseudonymizeHash('a@b.com', 'secret-1')).not.toBe(
      pseudonymizeHash('c@d.com', 'secret-1'),
    );
  });

  it('is rotatable: a different secret produces a different digest for the same value', () => {
    expect(pseudonymizeHash('1.2.3.4', 'secret-1')).not.toBe(
      pseudonymizeHash('1.2.3.4', 'secret-2'),
    );
  });

  it('is keyed — NOT the plain unsalted SHA-256 of the value', () => {
    const plainSha256 = createHash('sha256').update('1.2.3.4').digest('hex');
    expect(pseudonymizeHash('1.2.3.4', 'secret-1')).not.toBe(plainSha256);
  });

  it('falls back to the HASH_SECRET env var when no secret argument is given', () => {
    vi.stubEnv('HASH_SECRET', 'env-secret');
    expect(pseudonymizeHash('1.2.3.4')).toBe(pseudonymizeHash('1.2.3.4', 'env-secret'));
  });

  it('throws loud when HASH_SECRET is missing (misconfiguration must not silently de-key the hashes)', () => {
    vi.stubEnv('HASH_SECRET', '');
    expect(() => pseudonymizeHash('1.2.3.4')).toThrow(/HASH_SECRET/);
  });
});
