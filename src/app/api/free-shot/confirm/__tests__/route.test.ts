// James B1-P3 part-2 review F1 (MED): GET /api/free-shot/confirm is the only
// unauthenticated GET that hits Postgres (atomicConfirm UPDATE + diagnostic
// SELECT). Token brute-force is out of reach at 256-bit entropy — this gate
// exists purely to stop volumetric requests from saturating the DB.
//
// Wiring-level test (health-route pattern): real checkRateLimit logic runs
// against an injected in-memory FakeRedis; only the route's external seams
// (Redis client factory, verification DB) are mocked.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRedis } from '../../../../../lib/anti-abuse/__tests__/fake-redis';

// rateLimitKey is keyed by HASH_SECRET (GDPR F-NOW-1) — provide it for the suite.
beforeEach(() => {
  vi.stubEnv('HASH_SECRET', 'test-hash-secret');
});

const state = vi.hoisted(() => ({ redis: undefined as unknown }));

vi.mock('@/lib/anti-abuse/redis', () => ({
  getRedis: () => state.redis,
}));

vi.mock('@/lib/email/verification-db', () => ({
  atomicConfirm: vi.fn(),
  loadVerification: vi.fn(),
}));

function confirmRequest(ip: string, token = 'some-raw-token'): Request {
  return new Request(`https://example.com/api/free-shot/confirm?token=${token}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('GET /api/free-shot/confirm — per-IP rate limit', () => {
  beforeEach(() => {
    state.redis = new FakeRedis();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('confirms a valid token under the limit (200, single DB flip)', async () => {
    const { atomicConfirm } = await import('@/lib/email/verification-db');
    vi.mocked(atomicConfirm).mockResolvedValue(true);
    const { GET } = await import('../route');

    const response = await GET(confirmRequest('203.0.113.7'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, outcome: 'valid' });
    expect(atomicConfirm).toHaveBeenCalledTimes(1);
  });

  it('returns 429 with retryAfterSeconds once an IP exceeds the limit — without touching the DB', async () => {
    const { atomicConfirm } = await import('@/lib/email/verification-db');
    vi.mocked(atomicConfirm).mockResolvedValue(true);
    const { GET } = await import('../route');

    // Allowed budget: 10 confirm attempts per IP per window.
    for (let i = 0; i < 10; i++) {
      const ok = await GET(confirmRequest('203.0.113.7'));
      expect(ok.status).toBe(200);
    }

    const blocked = await GET(confirmRequest('203.0.113.7'));

    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    // The gate sits BEFORE the DB: the 11th request must not reach atomicConfirm.
    expect(atomicConfirm).toHaveBeenCalledTimes(10);
  });

  it('keeps independent budgets per IP (a hot IP must not block others)', async () => {
    const { atomicConfirm } = await import('@/lib/email/verification-db');
    vi.mocked(atomicConfirm).mockResolvedValue(true);
    const { GET } = await import('../route');

    for (let i = 0; i < 11; i++) {
      await GET(confirmRequest('203.0.113.7'));
    }
    const otherIp = await GET(confirmRequest('198.51.100.9'));

    expect(otherIp.status).toBe(200);
  });

  it('fails open when Redis is unreachable (rate limit degrades, confirm still works)', async () => {
    const { atomicConfirm } = await import('@/lib/email/verification-db');
    vi.mocked(atomicConfirm).mockResolvedValue(true);
    (state.redis as FakeRedis).failMode = true;
    const { GET } = await import('../route');

    const response = await GET(confirmRequest('203.0.113.7'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, outcome: 'valid' });
  });
});
