// Email-Verify composition — the synchronous half of the 4-layer pipeline.
//
// Layer 1 (disposable blocklist) and Layer 2 (MX lookup) run inline at
// submit and short-circuit in that order. Layer 3 (IP rate-limit at send)
// and Layer 4 (bounce webhook) fire at later signals and live elsewhere.
// An MX deadline overrun blocks with reason 'timeout' (plan-doc posture for
// this layer — the 2s cap keeps the submit path bounded either way).

import { normalizeEmail } from '../email';
import { isDisposable } from './disposable-detect';
import { hasValidMx, type MxResolver } from './mx-lookup';

export type ValidateEmailResult =
  | { valid: true }
  | {
      valid: false;
      /** 1 = disposable blocklist (and pre-layer format gate), 2 = MX lookup. */
      layer: 1 | 2;
      reason: 'invalid_format' | 'disposable' | 'no_mx' | 'timeout';
    };

/**
 * Validate an address through layers 1+2. Resolver/timeout are injectable
 * for tests; production callers pass the address only.
 */
export async function validateEmail(
  email: string,
  opts: { resolver?: MxResolver; timeoutMs?: number } = {},
): Promise<ValidateEmailResult> {
  let domain: string;
  try {
    const normalized = normalizeEmail(email);
    domain = normalized.slice(normalized.lastIndexOf('@') + 1);
    if (domain === '') {
      throw new Error('Invalid email');
    }
  } catch {
    return { valid: false, layer: 1, reason: 'invalid_format' };
  }

  if (isDisposable(domain)) {
    return { valid: false, layer: 1, reason: 'disposable' };
  }

  const mx = await hasValidMx(domain, opts);
  if (!mx.valid) {
    return { valid: false, layer: 2, reason: mx.reason ?? 'no_mx' };
  }

  return { valid: true };
}
