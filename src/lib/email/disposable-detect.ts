// Email-Verify Layer 1 — disposable-domain detection.
//
// The blocklist from `disposable-email-domains` is bundled as build-time JSON
// and loaded into a Set once at module init: every check is a pure in-memory
// lookup (<1ms, no I/O). Freshness of the bundled list is guarded by
// `scripts/validate-disposable-list.ts` (CI warning when >30 days stale),
// whose date math lives here as `isBlocklistStale` so it stays unit-tested.

import domains from 'disposable-email-domains';

const BLOCKLIST: ReadonlySet<string> = new Set(domains);

/** Max age of the bundled blocklist before the CI freshness check warns. */
export const BLOCKLIST_MAX_AGE_DAYS = 30;

/**
 * True when `domain` is a known disposable-email provider.
 * Input is normalized (trim + lowercase) before lookup.
 */
export function isDisposable(domain: string): boolean {
  return BLOCKLIST.has(domain.trim().toLowerCase());
}

/**
 * True when the bundled blocklist's publish date is older than
 * `maxAgeDays` (default 30) relative to `now`. Pure date math — the
 * registry lookup that feeds `publishedAt` lives in the CI script.
 */
export function isBlocklistStale(
  publishedAt: Date,
  now: Date,
  maxAgeDays: number = BLOCKLIST_MAX_AGE_DAYS,
): boolean {
  const ageMs = now.getTime() - publishedAt.getTime();
  return ageMs > maxAgeDays * 86_400_000;
}
