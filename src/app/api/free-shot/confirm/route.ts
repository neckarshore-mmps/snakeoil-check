// GET /api/free-shot/confirm?token=<...> (Task 3.6 confirm half).
// Atomic single-use flip. Decision logic in src/lib/email/confirm.ts
// (unit-tested); this wires the real DB ops. Phase 5 adds the redirect to
// the wait-page; for now it returns a typed JSON outcome.

import { CONFIRM_RATE_LIMIT, checkRateLimit, rateLimitKey } from '@/lib/anti-abuse/rate-limit';
import { getRedis } from '@/lib/anti-abuse/redis';
import { confirmEmailToken } from '@/lib/email/confirm';
import { atomicConfirm, loadVerification } from '@/lib/email/verification-db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return Response.json({ ok: false, error: 'missing token' }, { status: 400 });
  }

  // Trust assumption (James F3): on Vercel, x-forwarded-for is set by the
  // platform and the first entry is the real client IP — spoof-resistant
  // HERE, but NOT portable to other hosts where clients can inject the header.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';

  // Per-IP gate BEFORE any DB work (James F1): this is the only
  // unauthenticated GET that hits Postgres — keep volumetric traffic off the
  // DB. Fail-open posture matches the other anti-abuse read layers.
  const rl = await checkRateLimit(getRedis(), rateLimitKey('confirm-ip', ip), CONFIRM_RATE_LIMIT);
  if (rl.blocked) {
    return Response.json(
      { ok: false, reason: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  const outcome = await confirmEmailToken(token, {
    atomicConfirm,
    loadRecord: loadVerification,
  });

  // valid → 200; unknown token → 404; expired/already-used → 410 Gone.
  const status = outcome === 'valid' ? 200 : outcome === 'invalid' ? 404 : 410;
  return Response.json({ ok: outcome === 'valid', outcome }, { status });
}
