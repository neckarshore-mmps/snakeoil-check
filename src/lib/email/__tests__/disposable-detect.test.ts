import { describe, expect, it } from 'vitest';
import { disposableListMeta, isDisposable, isListStale } from '../disposable-detect';

// Email-Verification Layer 1 — disposable-domain detection.
// The blocklist is a build-time JSON snapshot (no runtime I/O): a Set lookup,
// so a check is O(1) and the bundle is reproducible + version-pinned. The
// snapshot carries `generatedAt` so `isListStale` can flag a >30-day-old list.

describe('isDisposable — Layer 1 disposable-email detection', () => {
  it('flags a known disposable domain (mailinator.com)', () => {
    expect(isDisposable('mailinator.com')).toBe(true);
  });

  it('passes a legitimate provider (gmail.com)', () => {
    expect(isDisposable('gmail.com')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isDisposable('MailInator.COM')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isDisposable('  mailinator.com  ')).toBe(true);
  });

  it('returns false for empty input rather than throwing', () => {
    expect(isDisposable('')).toBe(false);
  });

  it('checks in well under 1ms per call (no I/O, bundled Set lookup)', () => {
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) isDisposable('gmail.com');
    const perCheckMs = (performance.now() - start) / iterations;
    expect(perCheckMs).toBeLessThan(1);
  });
});

describe('disposable blocklist metadata + staleness', () => {
  it('bundles a non-empty, dated snapshot', () => {
    expect(disposableListMeta.count).toBeGreaterThan(1000);
    expect(Number.isNaN(Date.parse(disposableListMeta.generatedAt))).toBe(false);
  });

  it('flags a list older than maxDays as stale', () => {
    const generatedAt = '2026-01-01T00:00:00.000Z';
    const now = new Date('2026-03-01T00:00:00.000Z'); // ~59 days later
    expect(isListStale(generatedAt, now, 30)).toBe(true);
  });

  it('treats a fresh list as not stale', () => {
    const generatedAt = '2026-02-20T00:00:00.000Z';
    const now = new Date('2026-03-01T00:00:00.000Z'); // 9 days later
    expect(isListStale(generatedAt, now, 30)).toBe(false);
  });
});
