import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FakeRedis } from '../../anti-abuse/__tests__/fake-redis';
import { type SendConfirmDeps, sendConfirmEmail } from '../send-confirm';
import { hashToken } from '../token';

// Task 3.6 — send confirm-email (Layer 3 IP-rate-limit + token + Resend send).
// Pure orchestration against injected deps (FakeRedis + stub validator / sender)
// so the whole flow is unit-tested without a live DB or Resend.

beforeAll(() => {
  vi.stubEnv('HASH_SECRET', 'test-hash-secret');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const NOW = new Date('2026-06-11T12:00:00.000Z');
const BASE = 'https://snakeoilcheck.example/api/free-shot/confirm';

function makeDeps(over: Partial<SendConfirmDeps> = {}): {
  deps: SendConfirmDeps;
  inserted: Array<{ emailHash: string; tokenHash: string; expiresAt: Date }>;
  sent: Array<{ to: string; url: string }>;
} {
  const inserted: Array<{ emailHash: string; tokenHash: string; expiresAt: Date }> = [];
  const sent: Array<{ to: string; url: string }> = [];
  const deps: SendConfirmDeps = {
    store: new FakeRedis(),
    confirmBaseUrl: BASE,
    now: NOW,
    validate: async () => ({ valid: true }),
    insertVerification: async (row) => {
      inserted.push(row);
    },
    sendEmail: async (to, url) => {
      sent.push({ to, url });
      return { id: 'resend-msg-1' };
    },
    ...over,
  };
  return { deps, inserted, sent };
}

describe('sendConfirmEmail', () => {
  it('inserts a pending verification + sends a confirm-link, returning the message id', async () => {
    const { deps, inserted, sent } = makeDeps();

    const r = await sendConfirmEmail({ email: 'User@Example.com', ip: '203.0.113.7' }, deps);

    expect(r).toMatchObject({ outcome: 'sent', messageId: 'resend-msg-1' });
    expect(inserted).toHaveLength(1);
    expect(sent).toHaveLength(1);
    const row = inserted[0];
    const mail = sent[0];
    if (!row || !mail) throw new Error('expected one inserted row + one sent mail');
    // stored hash is the token's sha256, never the raw token
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.emailHash).toMatch(/^[a-f0-9]{64}$/);
    // the mailed link carries the RAW token, whose hash matches the stored hash
    const sentToken = new URL(mail.url).searchParams.get('token');
    expect(sentToken).toBeTruthy();
    expect(hashToken(sentToken as string)).toBe(row.tokenHash);
    // email normalised before sending
    expect(mail.to).toBe('user@example.com');
  });

  it('rate-limits by IP after 3 sends in the window (Layer 3, reuses the 2.2 primitive)', async () => {
    const { deps, sent } = makeDeps({ store: new FakeRedis() });
    const input = { email: 'a@b.com', ip: '203.0.113.9' };

    await sendConfirmEmail(input, deps);
    await sendConfirmEmail(input, deps);
    await sendConfirmEmail(input, deps);
    const fourth = await sendConfirmEmail(input, deps);

    expect(fourth.outcome).toBe('rate_limited');
    expect(sent).toHaveLength(3); // the 4th never sent
  });

  it('rejects an invalid email before inserting or sending', async () => {
    const { deps, inserted, sent } = makeDeps({
      validate: async () => ({ valid: false, layer: 1, reason: 'disposable' }),
    });

    const r = await sendConfirmEmail({ email: 'x@mailinator.com', ip: '203.0.113.1' }, deps);

    expect(r).toMatchObject({ outcome: 'invalid_email', reason: 'disposable' });
    expect(inserted).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('blocks an email-hash already flagged bounced (Layer 4 feedback) before sending', async () => {
    const { deps, inserted, sent } = makeDeps({ isBlocked: async () => true });

    const r = await sendConfirmEmail({ email: 'bounced@example.com', ip: '203.0.113.2' }, deps);

    expect(r.outcome).toBe('blocked');
    expect(inserted).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});
