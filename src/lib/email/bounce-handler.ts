// Task 3.5 — Resend bounce-webhook (anti-abuse Layer 4).
//
// A hard bounce / spam complaint marks every email_verifications row for that
// email-hash as 'bounced', which blocks future Free-Shots from that address
// (send-confirm checks the bounced flag before mailing — see send-confirm.ts).
//
// Signature verification is an INJECTED seam: production wires svix
// (Webhook.verify); tests inject a stub. The 401-on-bad-signature and the
// 503-on-missing-secret paths are therefore unit-tested (James posture-gate).

import { hashEmail, normalizeEmail } from '../email';

/** Resend event types that mean "stop mailing this address". */
export const RESEND_BOUNCE_EVENTS = ['email.bounced', 'email.complained'] as const;

export interface ResendWebhookEvent {
  type: string;
  data?: { to?: string[]; email_id?: string };
}

export interface BounceHandlerDeps {
  /** Mark every verification row for this email-hash bounced; returns rows touched. */
  markBounced: (emailHash: string, now: Date) => Promise<number>;
  /** Injected clock (deterministic bounced_at in tests). */
  now?: Date;
}

export interface BounceWebhookDeps extends BounceHandlerDeps {
  /** Verify + parse the raw webhook body; MUST throw on a bad signature. */
  verify: (rawBody: string, headers: Record<string, string>) => ResendWebhookEvent;
  /** Webhook signing secret; defaults to env RESEND_WEBHOOK_SECRET. */
  secret?: string;
}

export function isBounceEvent(type: string): boolean {
  return (RESEND_BOUNCE_EVENTS as readonly string[]).includes(type);
}

export interface BounceResult {
  handled: boolean;
  emailHash?: string;
  rowsBounced?: number;
}

/** Dispatch a parsed (already-verified) Resend event. */
export async function handleResendBounce(
  event: ResendWebhookEvent,
  deps: BounceHandlerDeps,
): Promise<BounceResult> {
  if (!isBounceEvent(event.type)) return { handled: false };

  const recipient = event.data?.to?.[0];
  if (!recipient) return { handled: false };

  const emailHash = hashEmail(normalizeEmail(recipient));
  const rowsBounced = await deps.markBounced(emailHash, deps.now ?? new Date());
  return { handled: true, emailHash, rowsBounced };
}

/**
 * HTTP handler for POST /api/resend/bounce-webhook. Verifies the svix
 * signature (fail closed) before dispatching. Auth posture mirrors the purge
 * cron: no secret → 503; bad signature → 401; valid → 200.
 */
export async function handleBounceWebhook(
  rawBody: string,
  headers: Record<string, string>,
  deps: BounceWebhookDeps,
): Promise<Response> {
  const secret = deps.secret ?? process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: 'webhook not configured' }, { status: 503 });
  }

  let event: ResendWebhookEvent;
  try {
    event = deps.verify(rawBody, headers);
  } catch {
    return Response.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  const result = await handleResendBounce(event, deps);
  return Response.json({ ok: true, ...result });
}
