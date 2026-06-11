// Keyed pseudonymization for identity values (GDPR F-NOW-1, Dr. Sommer
// baseline 2026-06-09).
//
// Hashed IPs / emails are PSEUDONYMOUS personal data under the GDPR (Breyer
// C-582/14; EDPB Guidelines 01/2022) — a plain unsalted SHA-256 lets anyone
// with a candidate value confirm membership by hashing it. HMAC-SHA256 keyed
// by a server-side, rotatable HASH_SECRET removes that confirmation attack:
// without the key, the digest is not linkable to the input.
//
// Rotation: roll HASH_SECRET in Vercel + keychain. Old digests become
// unlinkable; Redis keys derived from them simply expire via their TTLs.

import { createHmac } from 'node:crypto';

/**
 * HMAC-SHA256 a value with the given secret (defaults to env HASH_SECRET).
 * Returns a 64-char lowercase hex digest.
 *
 * Fails LOUD when no secret is available: silently falling back to an
 * unkeyed hash would quietly reintroduce the F-NOW-1 weakness.
 */
export function pseudonymizeHash(value: string, secret?: string): string {
  const key = secret ?? process.env.HASH_SECRET;
  if (!key) {
    throw new Error(
      'HASH_SECRET is not set — refusing to hash identity values unkeyed (GDPR F-NOW-1)',
    );
  }
  return createHmac('sha256', key).update(value).digest('hex');
}
