import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 200 with status=ok when DB ping succeeds', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ ok: 1 }] } as never);
    const { GET } = await import('../route');
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok', db: 'reachable' });
  });

  it('returns 503 when DB ping throws', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection refused'));
    const { GET } = await import('../route');
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ status: 'degraded', db: 'unreachable' });
  });
});
