import { afterEach, describe, expect, it, vi } from 'vitest';
import { checks } from '../../../db/schema';
import { handlePurgeCron, purgeExpiredChecks } from '../purge-expired';

// GDPR F-NOW-2 (Dr. Sommer baseline 2026-06-09): checks.expiresAt (+30d) had
// NO purge mechanism — Art. 5(1)(e) Speicherbegrenzung was an aspirational
// promise. This suite pins the purge logic + the cron route's auth posture.

const NOW = new Date('2026-06-11T03:17:00.000Z');

// Minimal Drizzle-shaped fake: captures the delete target + where condition,
// returns the configured rows from .returning(). DI per repo convention.
function makeFakeDb(rows: Array<{ id: string }>) {
  const calls: { table?: unknown; where?: unknown } = {};
  const fake = {
    delete(table: unknown) {
      calls.table = table;
      return {
        where(cond: unknown) {
          calls.where = cond;
          return { returning: () => Promise.resolve(rows) };
        },
      };
    },
  };
  return { fake, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('purgeExpiredChecks', () => {
  it('deletes from the checks table with a where condition and reports the count', async () => {
    const { fake, calls } = makeFakeDb([{ id: 'a' }, { id: 'b' }]);

    // biome-ignore lint/suspicious/noExplicitAny: minimal Drizzle-shaped fake
    const result = await purgeExpiredChecks(fake as any, NOW);

    expect(calls.table).toBe(checks);
    expect(calls.where).toBeDefined(); // expires_at < now AND expires_at IS NOT NULL
    expect(result.deletedChecks).toBe(2);
    expect(result.cutoff).toBe(NOW.toISOString());
  });

  it('reports zero when nothing is expired', async () => {
    const { fake } = makeFakeDb([]);

    // biome-ignore lint/suspicious/noExplicitAny: minimal Drizzle-shaped fake
    const result = await purgeExpiredChecks(fake as any, NOW);

    expect(result.deletedChecks).toBe(0);
  });
});

describe('handlePurgeCron (auth posture)', () => {
  const okPurge = async () => ({ deletedChecks: 3, cutoff: NOW.toISOString() });

  function req(auth?: string): Request {
    return new Request('https://example.com/api/cron/purge-expired', {
      headers: auth ? { authorization: auth } : {},
    });
  }

  it('fails CLOSED with 503 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const res = await handlePurgeCron(req('Bearer anything'), { purge: okPurge });

    expect(res.status).toBe(503);
  });

  it('rejects a missing Authorization header with 401', async () => {
    const res = await handlePurgeCron(req(), { purge: okPurge, secret: 's3cret' });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong bearer token with 401', async () => {
    const res = await handlePurgeCron(req('Bearer wrong'), { purge: okPurge, secret: 's3cret' });
    expect(res.status).toBe(401);
  });

  it('runs the purge and reports the count on a valid bearer token', async () => {
    const res = await handlePurgeCron(req('Bearer s3cret'), { purge: okPurge, secret: 's3cret' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, deletedChecks: 3 });
  });

  it('falls back to the CRON_SECRET env var when no secret is injected', async () => {
    vi.stubEnv('CRON_SECRET', 'env-secret');

    const res = await handlePurgeCron(req('Bearer env-secret'), { purge: okPurge });

    expect(res.status).toBe(200);
  });

  it('returns 500 without leaking error details when the purge throws', async () => {
    const failPurge = async () => {
      throw new Error('connection refused at 10.0.0.5:5432');
    };

    const res = await handlePurgeCron(req('Bearer s3cret'), { purge: failPurge, secret: 's3cret' });

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('10.0.0.5'); // no internal detail leak
  });
});
