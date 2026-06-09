// Email-Verification Layer 1 — disposable / throwaway-mailbox detection.
//
// The blocklist is the version-pinned `disposable-email-domains` package, bundled
// at build time into a Set. A check is therefore an O(1), zero-I/O Set lookup
// (the <1ms budget the funnel needs at submit-time). `disposable-list.meta.json`
// records when the list was last verified so `validate-disposable-list.ts` can
// warn when it goes stale (>30 days).

import rawDomains from 'disposable-email-domains/index.json';
import meta from './disposable-list.meta.json';

const blocklist = new Set<string>((rawDomains as string[]).map((domain) => domain.toLowerCase()));

/**
 * True when `domain` is a known disposable / throwaway mailbox provider.
 * Input is trimmed + lower-cased; empty/blank input returns false (not an error)
 * so callers can pass an un-validated value without a guard.
 */
export function isDisposable(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (normalized === '') return false;
  return blocklist.has(normalized);
}

/** Build-time metadata for the bundled blocklist. `count` is the live Set size. */
export const disposableListMeta = {
  generatedAt: meta.generatedAt,
  packageVersion: meta.packageVersion,
  count: blocklist.size,
} as const;

/**
 * True when a snapshot generated at `generatedAt` is older than `maxDays`
 * relative to `now`. `now` is injected (not read from the clock) so the rule is
 * deterministically testable.
 */
export function isListStale(generatedAt: string | Date, now: Date, maxDays = 30): boolean {
  const generated = typeof generatedAt === 'string' ? new Date(generatedAt) : generatedAt;
  const ageMs = now.getTime() - generated.getTime();
  return ageMs > maxDays * 24 * 60 * 60 * 1000;
}
