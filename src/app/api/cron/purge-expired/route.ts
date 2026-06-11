// Nightly purge of expired checks (GDPR F-NOW-2, Art. 5(1)(e)).
// Thin wrapper — auth posture + DB work live in src/lib/purge/purge-expired.ts.
// Scheduled via vercel.ts `crons`; Vercel sends `Authorization: Bearer CRON_SECRET`.

import { db } from '@/db';
import { handlePurgeCron, purgeExpiredChecks } from '@/lib/purge/purge-expired';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return handlePurgeCron(req, { purge: () => purgeExpiredChecks(db, new Date()) });
}
