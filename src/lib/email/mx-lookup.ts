// Email-Verification Layer 2 — MX-record lookup.
//
// Confirms a domain actually accepts mail by resolving its MX records. The
// lookup is bounded by a hard timeout so a slow or black-holed DNS server can
// never stall the submit path, and a timeout is reported distinctly from a
// genuine no-MX result (the caller may want to retry a timeout but not a no_mx).

import { resolveMx } from 'node:dns/promises';

/** Default DNS lookup budget — a slow resolver must not stall the submit path. */
export const MX_LOOKUP_TIMEOUT_MS = 2000;

export interface MxLookupResult {
  /** True when the domain has at least one MX record. */
  valid: boolean;
  /** Why the lookup failed — present only when `valid` is false. */
  reason?: 'no_mx' | 'timeout';
}

export interface MxLookupOptions {
  /** Lookup budget in milliseconds (default `MX_LOOKUP_TIMEOUT_MS`). */
  timeoutMs?: number;
}

/**
 * Resolve `domain`'s MX records, bounded by a timeout.
 *
 * A rejected or empty resolution is treated as `no_mx`; exceeding the budget is
 * reported as `timeout` so it stays distinguishable from a real no-MX domain.
 */
export async function hasValidMx(
  domain: string,
  opts: MxLookupOptions = {},
): Promise<MxLookupResult> {
  const timeoutMs = opts.timeoutMs ?? MX_LOOKUP_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<MxLookupResult>((resolve) => {
    timer = setTimeout(() => resolve({ valid: false, reason: 'timeout' }), timeoutMs);
  });

  const lookup = resolveMx(domain)
    .then(
      (records): MxLookupResult =>
        records.length > 0 ? { valid: true } : { valid: false, reason: 'no_mx' },
    )
    .catch((): MxLookupResult => ({ valid: false, reason: 'no_mx' }));

  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
