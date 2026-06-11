import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  handleBounceWebhook,
  handleResendBounce,
  isBounceEvent,
  type ResendWebhookEvent,
} from '../bounce-handler';

// Task 3.5 — Resend bounce-webhook (anti-abuse Layer 4). A hard bounce /
// complaint marks the email-hash bounced so future Free-Shots are blocked.
// Signature verification is an injected seam (svix in prod, stub here) so the
// 401-on-bad-signature path is unit-tested (James posture-gate concern).

beforeAll(() => {
  vi.stubEnv('HASH_SECRET', 'test-hash-secret');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const NOW = new Date('2026-06-11T12:00:00.000Z');

describe('isBounceEvent', () => {
  it('recognises hard bounce + complaint, ignores delivered/sent', () => {
    expect(isBounceEvent('email.bounced')).toBe(true);
    expect(isBounceEvent('email.complained')).toBe(true);
    expect(isBounceEvent('email.delivered')).toBe(false);
    expect(isBounceEvent('email.sent')).toBe(false);
  });
});

describe('handleResendBounce', () => {
  it('marks the recipient email-hash bounced on a hard bounce', async () => {
    const seen: string[] = [];
    const event: ResendWebhookEvent = {
      type: 'email.bounced',
      data: { to: ['User@Example.com'] },
    };

    const r = await handleResendBounce(event, {
      now: NOW,
      markBounced: async (hash) => {
        seen.push(hash);
        return 1;
      },
    });

    expect(r.handled).toBe(true);
    expect(r.rowsBounced).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^[a-f0-9]{64}$/); // keyed hash, not plaintext
    expect(seen[0]).not.toContain('Example');
  });

  it('treats a complaint the same as a hard bounce', async () => {
    let called = false;
    const markBounced = async () => {
      called = true;
      return 1;
    };
    const r = await handleResendBounce(
      { type: 'email.complained', data: { to: ['a@b.com'] } },
      { now: NOW, markBounced },
    );
    expect(r.handled).toBe(true);
    expect(called).toBe(true);
  });

  it('ignores a non-bounce event without touching the DB', async () => {
    let called = false;
    const markBounced = async () => {
      called = true;
      return 1;
    };
    const r = await handleResendBounce(
      { type: 'email.delivered', data: { to: ['a@b.com'] } },
      { now: NOW, markBounced },
    );
    expect(r.handled).toBe(false);
    expect(called).toBe(false);
  });

  it('ignores a bounce event with no recipient', async () => {
    let called = false;
    const markBounced = async () => {
      called = true;
      return 1;
    };
    const r = await handleResendBounce(
      { type: 'email.bounced', data: {} },
      { now: NOW, markBounced },
    );
    expect(r.handled).toBe(false);
    expect(called).toBe(false);
  });
});

describe('handleBounceWebhook (signature posture)', () => {
  const goodEvent: ResendWebhookEvent = { type: 'email.bounced', data: { to: ['a@b.com'] } };
  const okVerify = () => goodEvent;
  const badVerify = () => {
    throw new Error('signature mismatch');
  };
  const markBounced = async () => 1;

  it('fails CLOSED with 503 when RESEND_WEBHOOK_SECRET is absent', async () => {
    const res = await handleBounceWebhook('{}', {}, { verify: okVerify, markBounced, secret: '' });
    expect(res.status).toBe(503);
  });

  it('returns 401 on an invalid signature (does not run the handler)', async () => {
    let called = false;
    const markBounced = async () => {
      called = true;
      return 1;
    };
    const res = await handleBounceWebhook(
      '{}',
      {},
      { secret: 'whsec_x', verify: badVerify, markBounced },
    );
    expect(res.status).toBe(401);
    expect(called).toBe(false);
  });

  it('returns 200 and processes a valid, signed bounce', async () => {
    const res = await handleBounceWebhook(
      '{}',
      {},
      { secret: 'whsec_x', verify: okVerify, markBounced, now: NOW },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, handled: true });
  });
});
