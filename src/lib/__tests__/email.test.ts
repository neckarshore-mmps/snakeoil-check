import { describe, expect, it } from 'vitest';
import { hashEmail, normalizeEmail } from '../email';

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
  it('produces a stable SHA-256 hex digest for a normalized email', () => {
    const hash = hashEmail('foo@example.com');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashEmail('foo@example.com')).toBe(hash);
  });

  it('produces different hashes for different emails', () => {
    expect(hashEmail('a@b.com')).not.toBe(hashEmail('c@d.com'));
  });
});
