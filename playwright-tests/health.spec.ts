import { expect, test } from '@playwright/test';

test.describe('health endpoint', () => {
  test('GET /api/health returns 200 ok with reachable DB', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { status: string; db: string };
    expect(json).toEqual({ status: 'ok', db: 'reachable' });
  });
});
