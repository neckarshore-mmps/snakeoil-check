// Email-Verify Layer 2 — MX-record lookup via Node's dns/promises.
//
// The resolver is injected (same inject-store pattern as the anti-abuse Redis
// layers) so unit tests exercise the real deadline/filter logic against fakes
// while the integration tier hits real DNS. Hard 2s deadline: an unresponsive
// nameserver must never stall the submit path.

import { resolveMx } from 'node:dns/promises';

/** Shape of one MX record as returned by dns/promises.resolveMx. */
export interface MxRecord {
  exchange: string;
  priority: number;
}

/** Minimal resolver surface — injectable for unit tests. */
export interface MxResolver {
  resolveMx(domain: string): Promise<MxRecord[]>;
}

export interface MxLookupResult {
  valid: boolean;
  reason?: 'no_mx' | 'timeout';
}

/** Hard deadline per lookup — a slow nameserver must not stall submits. */
export const MX_TIMEOUT_MS = 2_000;

const DEFAULT_RESOLVER: MxResolver = { resolveMx };

const TIMEOUT = Symbol('mx-timeout');

/**
 * True when `domain` publishes at least one usable MX record.
 *
 * - DNS failure of any kind (NXDOMAIN, no data, …) → `{ valid: false, reason: 'no_mx' }`
 * - Null-MX (RFC 7505, empty/"." exchange) → `no_mx` — domain explicitly refuses mail
 * - Deadline exceeded → `{ valid: false, reason: 'timeout' }`
 */
export async function hasValidMx(
  domain: string,
  opts: { resolver?: MxResolver; timeoutMs?: number } = {},
): Promise<MxLookupResult> {
  const { resolver = DEFAULT_RESOLVER, timeoutMs = MX_TIMEOUT_MS } = opts;

  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
  });

  try {
    // Pre-attach a catch so a lookup that loses the race and rejects later
    // never surfaces as an unhandled rejection.
    const lookup = resolver.resolveMx(domain.trim().toLowerCase());
    lookup.catch(() => {});

    const raced = await Promise.race([lookup, deadline]);
    if (raced === TIMEOUT) {
      return { valid: false, reason: 'timeout' };
    }

    const usable = raced.filter((r) => r.exchange !== '' && r.exchange !== '.');
    return usable.length > 0 ? { valid: true } : { valid: false, reason: 'no_mx' };
  } catch {
    // ENOTFOUND / ENODATA / servfail — no deliverable MX either way.
    return { valid: false, reason: 'no_mx' };
  } finally {
    clearTimeout(timer);
  }
}
