import { pseudonymizeHash } from './pseudonymize';

export function normalizeEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed?.includes('@')) {
    throw new Error('Invalid email');
  }
  return trimmed;
}

/**
 * Keyed (HMAC-SHA256, HASH_SECRET) digest of a normalized email. The digest
 * is PSEUDONYMOUS personal data (GDPR F-NOW-1) — keying prevents membership
 * confirmation by hashing a candidate address, but it is NOT anonymization.
 */
export function hashEmail(normalizedEmail: string): string {
  return pseudonymizeHash(normalizedEmail);
}
