import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashEmail, normalizeEmail } from '../email';

// hashEmail is keyed by HASH_SECRET (GDPR F-NOW-1) — provide it for the suite.
beforeAll(() => {
  vi.stubEnv('HASH_SECRET', 'test-hash-secret');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Foo@Example.COM  ')).toBe('foo@example.com');
  });

  it('rejects strings without @', () => {
    expect(() => normalizeEmail('notanemail')).toThrow('Invalid email');
  });

  it('rejects empty strings', () => {
    expect(() => normalizeEmail('')).toThrow('Invalid email');
  });

  it('rejects strings with only whitespace', () => {
    expect(() => normalizeEmail('   ')).toThrow('Invalid email');
  });
});

describe('hashEmail', () => {
  it('produces a stable hex digest for a normalized email', () => {
    const hash = hashEmail('foo@example.com');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashEmail('foo@example.com')).toBe(hash);
  });

  it('produces different hashes for different emails', () => {
    expect(hashEmail('a@b.com')).not.toBe(hashEmail('c@d.com'));
  });

  it('is keyed (HMAC) — NOT the plain unsalted SHA-256 of the email (GDPR F-NOW-1)', () => {
    const plainSha256 = createHash('sha256').update('foo@example.com').digest('hex');
    expect(hashEmail('foo@example.com')).not.toBe(plainSha256);
  });
});
