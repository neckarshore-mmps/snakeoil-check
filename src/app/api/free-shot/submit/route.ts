// POST /api/free-shot/submit (Task 3.6 + anti-abuse gate).
// Anti-abuse pipeline → send confirm-email. Decision logic is unit-tested
// (send-confirm.ts / anti-abuse/*); this wires the real Redis + DB + Resend.

import { runFreeShotAntiAbuse } from '@/lib/anti-abuse';
import { getRedis } from '@/lib/anti-abuse/redis';
import { sendConfirmMail } from '@/lib/email/resend-client';
import { sendConfirmEmail } from '@/lib/email/send-confirm';
import { insertVerification, isEmailBlocked } from '@/lib/email/verification-db';

export const dynamic = 'force-dynamic';

interface SubmitBody {
  email?: string;
  url?: string;
  turnstileToken?: string;
  cookieId?: string;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as SubmitBody | null;
  if (!body?.email || !body.url || !body.turnstileToken) {
    return Response.json({ ok: false, error: 'missing fields' }, { status: 400 });
  }

  // Trust assumption (James F3): on Vercel, x-forwarded-for is set by the
  // platform and the first entry is the real client IP — spoof-resistant
  // HERE, but NOT portable to other hosts where clients can inject the header.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';

  // 1. Anti-abuse gate: turnstile → rate-limit → url-dedup → kill-switch.
  const gate = await runFreeShotAntiAbuse({
    turnstileToken: body.turnstileToken,
    ip,
    url: body.url,
    cookieId: body.cookieId,
  });
  if (gate.outcome === 'blocked') {
    return Response.json(
      {
        ok: false,
        layer: gate.layer,
        reason: gate.reason,
        retryAfterSeconds: gate.retryAfterSeconds,
      },
      { status: gate.status },
    );
  }
  if (gate.outcome === 'cached') {
    return Response.json({ ok: true, cached: true, result: gate.result });
  }

  // 2. Send the confirm email (Layer 3 rate-limit + validation + token mint).
  const confirmBaseUrl = `${process.env.APP_BASE_URL ?? new URL(req.url).origin}/api/free-shot/confirm`;
  const result = await sendConfirmEmail(
    { email: body.email, ip },
    {
      store: getRedis(),
      insertVerification,
      isBlocked: isEmailBlocked,
      sendEmail: sendConfirmMail,
      confirmBaseUrl,
    },
  );

  switch (result.outcome) {
    case 'sent':
      return Response.json({ ok: true, status: 'confirmation_sent' });
    case 'rate_limited':
      return Response.json(
        { ok: false, reason: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds },
        { status: 429 },
      );
    case 'invalid_email':
      return Response.json({ ok: false, reason: result.reason }, { status: 422 });
    case 'blocked':
      return Response.json({ ok: false, reason: 'blocked' }, { status: 403 });
  }
}
