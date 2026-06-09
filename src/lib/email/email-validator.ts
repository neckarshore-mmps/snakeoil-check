// Email-Verification pipeline — synchronous-ish front (Layers 1 + 2).
//
// Layer 1 (disposable) is a fast in-memory check and runs first, so a throwaway
// address never costs a DNS lookup. Layer 2 (MX) confirms the domain can receive
// mail. Layers 3 (IP rate-limit, Task 2.2 primitive) + 4 (bounce webhook) act on
// later signals (send-time / Resend callback), not in this call.

import { isDisposable } from './disposable-detect';
import { hasValidMx, type MxResolver } from './mx-lookup';

export type EmailValidationLayer = 0 | 1 | 2;

export type EmailValidationReason = 'invalid_format' | 'disposable' | 'no_mx' | 'timeout' | 'error';

export interface EmailValidationResult {
  valid: boolean;
  /** Layer that rejected (0 = format, 1 = disposable, 2 = MX). Absent when valid. */
  layer?: EmailValidationLayer;
  reason?: EmailValidationReason;
}

export interface ValidateEmailOptions {
  /** Passed through to the MX layer (tests inject a fake resolver). */
  resolver?: MxResolver;
  /** MX lookup budget in ms. */
  timeoutMs?: number;
}

/**
 * Extract the lowercased domain from an address, or null when the address is
 * syntactically unusable (missing/empty local or domain part, no dot in domain).
 */
function extractDomain(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain.includes('.')) return null;
  return domain;
}

/** Run Layers 1 + 2 against `email`. Never throws — failures map to a typed result. */
export async function validateEmail(
  email: string,
  opts: ValidateEmailOptions = {},
): Promise<EmailValidationResult> {
  const domain = extractDomain(email);
  if (domain === null) {
    return { valid: false, layer: 0, reason: 'invalid_format' };
  }

  // Layer 1 — disposable (fast, in-memory; short-circuits before DNS).
  if (isDisposable(domain)) {
    return { valid: false, layer: 1, reason: 'disposable' };
  }

  // Layer 2 — MX records.
  const mx = await hasValidMx(domain, opts);
  if (!mx.valid) {
    return { valid: false, layer: 2, reason: mx.reason ?? 'no_mx' };
  }

  return { valid: true };
}
