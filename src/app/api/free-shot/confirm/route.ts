// GET /api/free-shot/confirm?token=<...> (Task 3.6 confirm half).
// Atomic single-use flip. Decision logic in src/lib/email/confirm.ts
// (unit-tested); this wires the real DB ops. Phase 5 adds the redirect to
// the wait-page; for now it returns a typed JSON outcome.

import { confirmEmailToken } from '@/lib/email/confirm';
import { atomicConfirm, loadVerification } from '@/lib/email/verification-db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return Response.json({ ok: false, error: 'missing token' }, { status: 400 });
  }

  const outcome = await confirmEmailToken(token, {
    atomicConfirm,
    loadRecord: loadVerification,
  });

  // valid → 200; unknown token → 404; expired/already-used → 410 Gone.
  const status = outcome === 'valid' ? 200 : outcome === 'invalid' ? 404 : 410;
  return Response.json({ ok: outcome === 'valid', outcome }, { status });
}
