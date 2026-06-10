// 4-Layer email validator — synchronous composition of Layers 1 + 2.
//
// Layer 1 (disposable blocklist) is cheap and runs first, short-circuiting the
// network round-trip of Layer 2 (MX lookup) for obviously-bad addresses. A
// malformed-address pre-check guards both layers. Layers 3 (token/IP) and 4
// (bounce webhook) are deferred — they fire on later signals, not at submit.

import { isDisposable } from './disposable-detect';
import { hasValidMx } from './mx-lookup';

export interface EmailValidationResult {
  /** True only when every synchronous layer (1 + 2) passed. */
  valid: boolean;
  /** Which layer rejected the address — present only on failure. */
  layer?: 1 | 2;
  /** Machine-readable rejection reason — present only on failure. */
  reason?: 'malformed' | 'disposable' | 'no_mx' | 'timeout';
}

// Deliberately permissive structural check — full RFC 5322 validation is a
// rabbit hole; we only need to reject input that has no parseable domain.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email through Layers 1 + 2.
 *
 * @returns `{ valid: true }` when both layers pass, otherwise the first failing
 *          layer with a reason. Layer 1 short-circuits Layer 2.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const trimmed = email.trim();
  if (!EMAIL_SHAPE.test(trimmed)) {
    return { valid: false, reason: 'malformed' };
  }

  const domain = trimmed.slice(trimmed.lastIndexOf('@') + 1).toLowerCase();

  // Layer 1 — disposable blocklist (sync, no I/O). Short-circuits Layer 2.
  if (isDisposable(domain)) {
    return { valid: false, layer: 1, reason: 'disposable' };
  }

  // Layer 2 — MX lookup (async, bounded).
  const mx = await hasValidMx(domain);
  if (!mx.valid) {
    return { valid: false, layer: 2, reason: mx.reason ?? 'no_mx' };
  }

  return { valid: true };
}
