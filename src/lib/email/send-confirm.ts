// Task 3.6 — send confirm-email (anti-abuse Layer 3 + token mint + Resend send).
//
// Runs AFTER the anti-abuse pipeline (turnstile → rate-limit → url-dedup →
// kill-switch) in /api/free-shot/submit. Order here (Bob submit-route rec):
//   IP-rate-limit (O(1) Redis) → validate (disposable free, then MX/DNS cost)
//   → bounced-block check (Layer 4 feedback) → mint token → insert pending
//   → Resend send.
// Pure orchestration over injected deps so the whole flow is unit-tested
// without a live DB or Resend.

import { checkRateLimit, FREE_SHOT_RATE_LIMIT, rateLimitKey } from '../anti-abuse/rate-limit';
import type { RedisLike } from '../anti-abuse/redis';
import { hashEmail, normalizeEmail } from '../email';
import {
  type EmailValidationResult,
  type ValidateEmailOptions,
  validateEmail,
} from './email-validator';
import { generateToken } from './token';

export interface SendConfirmInput {
  email: string;
  ip: string;
}

export interface VerificationInsert {
  emailHash: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface SendConfirmDeps {
  store: RedisLike;
  /** Persist a pending email_verifications row (status defaults to 'pending'). */
  insertVerification: (row: VerificationInsert) => Promise<void>;
  /** Send the confirm mail; returns the provider message id (Resend). */
  sendEmail: (to: string, confirmUrl: string) => Promise<{ id: string }>;
  /** Absolute confirm endpoint, e.g. https://host/api/free-shot/confirm. */
  confirmBaseUrl: string;
  /** Layer 4 feedback: is this email-hash already flagged bounced? */
  isBlocked?: (emailHash: string) => Promise<boolean>;
  /** Override the Layer 1+2 validator (tests inject a stub). */
  validate?: (email: string, opts?: ValidateEmailOptions) => Promise<EmailValidationResult>;
  /** Injected clock for deterministic token expiry. */
  now?: Date;
}

export type SendConfirmOutcome =
  | { outcome: 'sent'; messageId: string; emailHash: string }
  | { outcome: 'rate_limited'; retryAfterSeconds?: number }
  | { outcome: 'invalid_email'; reason: string }
  | { outcome: 'blocked' };

export async function sendConfirmEmail(
  input: SendConfirmInput,
  deps: SendConfirmDeps,
): Promise<SendConfirmOutcome> {
  // Layer 3 — IP rate-limit (max 3 / 24h per IP-hash; reuses the 2.2 primitive).
  const rl = await checkRateLimit(
    deps.store,
    rateLimitKey('email-ip', input.ip),
    FREE_SHOT_RATE_LIMIT,
  );
  if (rl.blocked) {
    return { outcome: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds };
  }

  // Layers 1+2 — disposable (free) then MX (DNS cost).
  const validate = deps.validate ?? validateEmail;
  const validation = await validate(input.email);
  if (!validation.valid) {
    return { outcome: 'invalid_email', reason: validation.reason ?? 'invalid' };
  }

  const emailHash = hashEmail(normalizeEmail(input.email));

  // Layer 4 — refuse addresses a prior webhook flagged bounced/complained.
  if (deps.isBlocked && (await deps.isBlocked(emailHash))) {
    return { outcome: 'blocked' };
  }

  // Mint the single-use token; only its hash is persisted (raw goes in the mail).
  const { token, tokenHash, expiresAt } = generateToken({ now: deps.now });
  await deps.insertVerification({ emailHash, tokenHash, expiresAt });

  const confirmUrl = `${deps.confirmBaseUrl}?token=${encodeURIComponent(token)}`;
  const sent = await deps.sendEmail(normalizeEmail(input.email), confirmUrl);
  return { outcome: 'sent', messageId: sent.id, emailHash };
}
