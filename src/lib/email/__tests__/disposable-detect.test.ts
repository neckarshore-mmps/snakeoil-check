import { describe, expect, it } from 'vitest';
import { isDisposable } from '../disposable-detect';

// Email-Verification Layer 1 — disposable-domain blocklist.
// Backed by the build-time-bundled `disposable-email-domains` list (Set lookup,
// no I/O), so every check is O(1) and runs in the request path safely.

describe('isDisposable (email Layer 1 — disposable blocklist)', () => {
  it('flags a known disposable domain', () => {
    expect(isDisposable('mailinator.com')).toBe(true);
  });

  it('does not flag a mainstream provider', () => {
    expect(isDisposable('gmail.com')).toBe(false);
  });

  it('is case-insensitive (real email domains arrive in mixed case)', () => {
    expect(isDisposable('MAILINATOR.COM')).toBe(true);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(isDisposable('  mailinator.com  ')).toBe(true);
  });

  it('checks in well under 1ms per call (bundled list, no I/O)', () => {
    isDisposable('gmail.com'); // warm path
    const iterations = 2000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      isDisposable('mailinator.com');
      isDisposable('gmail.com');
    }
    const perCheckMs = (performance.now() - start) / (iterations * 2);
    expect(perCheckMs).toBeLessThan(1);
  });
});
