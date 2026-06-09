// Email-Verification Layer 2 — MX-record validation.
//
// A domain that resolves no MX records cannot receive mail, so the confirm-email
// would bounce. We check before sending. The DNS resolver is injected (default =
// Node's `dns/promises.resolveMx`) so the unit tier is deterministic and offline
// — no `dns` module mock, which would test the mock rather than this logic.
//
// Posture: a transient DNS failure ('error') is reported distinctly from a
// genuine 'no_mx', so the caller can choose to retry/allow on infra hiccups
// rather than reject a legitimate address.

import { resolveMx } from 'node:dns/promises';

/** Shape of the records returned by `dns/promises.resolveMx`. */
export type MxResolver = (hostname: string) => Promise<{ exchange: string; priority: number }[]>;

export type MxFailureReason = 'no_mx' | 'timeout' | 'error';

export interface MxResult {
  valid: boolean;
  reason?: MxFailureReason;
}

export interface MxOptions {
  /** Override the DNS resolver (tests inject a fake; default is real DNS). */
  resolver?: MxResolver;
  /** Lookup budget in ms before returning `{ valid: false, reason: 'timeout' }`. */
  timeoutMs?: number;
}

export const DEFAULT_MX_TIMEOUT_MS = 2000;

/**
 * Resolve `domain`'s MX records and classify the outcome. Never rejects: every
 * failure mode maps to a typed `reason`.
 */
export async function hasValidMx(domain: string, opts: MxOptions = {}): Promise<MxResult> {
  const resolver = opts.resolver ?? resolveMx;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_MX_TIMEOUT_MS;

  const normalized = domain.trim().toLowerCase();
  if (normalized === '') return { valid: false, reason: 'no_mx' };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<MxResult>((resolve) => {
    timer = setTimeout(() => resolve({ valid: false, reason: 'timeout' }), timeoutMs);
  });

  // `lookup` resolves to a result for every path (including rejection) so a
  // post-timeout settle never surfaces as an unhandled rejection.
  const lookup: Promise<MxResult> = resolver(normalized)
    .then((records) =>
      records.length > 0
        ? ({ valid: true } as MxResult)
        : ({ valid: false, reason: 'no_mx' } as MxResult),
    )
    .catch((err: unknown) => {
      const code = (err as NodeJS.ErrnoException).code;
      return code === 'ENOTFOUND' || code === 'ENODATA'
        ? ({ valid: false, reason: 'no_mx' } as MxResult)
        : ({ valid: false, reason: 'error' } as MxResult);
    });

  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
