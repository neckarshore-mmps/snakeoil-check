import { describe, expect, it } from 'vitest';
import { isListStale } from '../../../../scripts/validate-disposable-list';

// CI-check helper: the bundled disposable blocklist should be refreshed
// regularly. `isListStale` is the pure decision used by
// `scripts/validate-disposable-list.ts` (the I/O wrapper warns, never fails CI).

describe('isListStale (disposable-list freshness guard)', () => {
  const now = new Date('2026-06-10T00:00:00Z');

  it('is fresh when published within the threshold', () => {
    const published = new Date('2026-05-25T00:00:00Z'); // 16 days old
    expect(isListStale(published, now, 30)).toBe(false);
  });

  it('is stale when older than the threshold', () => {
    const published = new Date('2026-04-01T00:00:00Z'); // ~70 days old
    expect(isListStale(published, now, 30)).toBe(true);
  });

  it('defaults to a 30-day threshold', () => {
    const justUnder = new Date('2026-05-12T00:00:00Z'); // 29 days old
    const justOver = new Date('2026-05-10T00:00:00Z'); // 31 days old
    expect(isListStale(justUnder, now)).toBe(false);
    expect(isListStale(justOver, now)).toBe(true);
  });
});
