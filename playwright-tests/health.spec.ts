import { expect, test } from '@playwright/test';

// The health endpoint pings the DB. Without DATABASE_URL the dev
// server returns 503 (degraded). Skip in CI when no DB secret is
// wired up; run locally and in environments that have the secret.
test.describe('health endpoint', () => {
  test.skip(
    !process.env.DATABASE_URL,
    'DATABASE_URL not set — skipping DB-dependent health check. ' +
      'Set DATABASE_URL_TEST repo secret to enable in CI.',
  );

  test('GET /api/health returns 200 ok with reachable DB', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { status: string; db: string };
    expect(json).toEqual({ status: 'ok', db: 'reachable' });
  });
});
