import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import vercelConfig from '../../../../vercel';
import { checkResults } from '../../../db/schema';

// GDPR F-NOW-2 — the purge only enforces Art. 5(1)(e) if (a) Vercel actually
// schedules it and (b) deleting a check cascades to its check_results row.
// Both are config, not logic — pin them so a refactor cannot silently drop them.

describe('purge cron wiring (vercel.ts)', () => {
  it('schedules the purge route nightly', () => {
    const crons = vercelConfig.crons ?? [];
    const purgeCron = crons.find((c) => c.path === '/api/cron/purge-expired');

    expect(purgeCron).toBeDefined();
    // five-field cron expression, daily (no */N day tricks)
    expect(purgeCron?.schedule).toMatch(/^\S+ \S+ \* \* \*$/);
  });
});

describe('check_results cascade (schema pin)', () => {
  it('deleting a check cascades to its check_results row', () => {
    const fks = getTableConfig(checkResults).foreignKeys;
    const checkFk = fks.find((fk) => fk.reference().foreignColumns.some((c) => c.name === 'id'));

    expect(checkFk).toBeDefined();
    expect(checkFk?.onDelete).toBe('cascade');
  });
});
