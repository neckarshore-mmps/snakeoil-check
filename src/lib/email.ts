import { createHash } from 'node:crypto';

export function normalizeEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed?.includes('@')) {
    throw new Error('Invalid email');
  }
  return trimmed;
}

export function hashEmail(normalizedEmail: string): string {
  return createHash('sha256').update(normalizedEmail).digest('hex');
}
