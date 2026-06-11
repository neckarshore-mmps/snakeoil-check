// POST /api/resend/bounce-webhook (Task 3.5, anti-abuse Layer 4).
// Verifies the svix signature, then marks bounced/complained addresses.
// Posture + dispatch live in src/lib/email/bounce-handler.ts (unit-tested).

import { Webhook } from 'svix';
import { handleBounceWebhook, type ResendWebhookEvent } from '@/lib/email/bounce-handler';
import { markBounced } from '@/lib/email/verification-db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  return handleBounceWebhook(rawBody, headers, {
    markBounced,
    // svix verifier — throws on a bad signature, which the handler maps to 401.
    // The handler's missing-secret guard (503) runs before this is called.
    verify: (body, hdrs) =>
      new Webhook(process.env.RESEND_WEBHOOK_SECRET ?? '').verify(body, hdrs) as ResendWebhookEvent,
  });
}
