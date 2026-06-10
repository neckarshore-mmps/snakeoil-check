import { describe, expect, it } from 'vitest';
import { isBlocklistStale, isDisposable } from '../disposable-detect';

// Email-Verify Layer 1 — disposable-domain blocklist (bundled, no I/O).
// The blocklist ships as build-time JSON from `disposable-email-domains`,
// loaded into a Set at module init — every check is a pure in-memory lookup.

describe('isDisposable (email-verify Layer 1)', () => {
  it('flags a known disposable domain', () => {
    expect(isDisposable('mailinator.com')).toBe(true);
  });

  it('passes a legitimate provider domain', () => {
    expect(isDisposable('gmail.com')).toBe(false);
  });

  it('normalizes case and surrounding whitespace before lookup', () => {
    expect(isDisposable('  MAILINATOR.COM  ')).toBe(true);
    expect(isDisposable('GMAIL.com')).toBe(false);
  });

  it('checks in <1ms per lookup (bundled list, no I/O)', () => {
    // Warm-up: force module-level Set init out of the measured window.
    isDisposable('warmup.example');

    const RUNS = 1_000;
    const start = performance.now();
    for (let i = 0; i < RUNS; i++) {
      isDisposable(i % 2 === 0 ? 'mailinator.com' : 'gmail.com');
    }
    const avgMs = (performance.now() - start) / RUNS;

    expect(avgMs).toBeLessThan(1);
  });
});

describe('isBlocklistStale (freshness logic for scripts/validate-disposable-list.ts)', () => {
  const NOW = new Date('2026-06-10T12:00:00Z');
  const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

  it('reports stale when the bundled list is older than 30 days', () => {
    expect(isBlocklistStale(days(31), NOW)).toBe(true);
  });

  it('reports fresh within the 30-day window', () => {
    expect(isBlocklistStale(days(29), NOW)).toBe(false);
    expect(isBlocklistStale(days(30), NOW)).toBe(false);
  });
});
