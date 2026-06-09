import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  checkResults,
  checks,
  curatedExamples,
  emailSubscribers,
  emailVerifications,
  rateLimits,
  users,
} from '../schema';

describe('users table schema', () => {
  it('exposes the expected columns', () => {
    const columns = getTableColumns(users);
    expect(Object.keys(columns).sort()).toEqual([
      'createdAt',
      'emailHash',
      'emailPlain',
      'id',
      'lastLoginAt',
    ]);
  });

  it('marks emailHash with unique + notNull constraints', () => {
    const columns = getTableColumns(users);
    expect(columns.emailHash.notNull).toBe(true);
    expect(columns.emailHash.isUnique).toBe(true);
  });

  it('marks id as primary key', () => {
    const columns = getTableColumns(users);
    expect(columns.id.primary).toBe(true);
  });

  it('makes lastLoginAt optional', () => {
    const columns = getTableColumns(users);
    expect(columns.lastLoginAt.notNull).toBe(false);
  });
});

describe('checks table schema (Phase-2-A)', () => {
  it('has required workflow columns', () => {
    const columns = getTableColumns(checks);
    expect(columns.id).toBeDefined();
    expect(columns.resultToken).toBeDefined();
    expect(columns.tier).toBeDefined();
    expect(columns.paymentStatus).toBeDefined();
    expect(columns.workflowStatus).toBeDefined();
    expect(columns.scrapeStatus).toBeDefined();
  });

  it('marks id as primary key', () => {
    const columns = getTableColumns(checks);
    expect(columns.id.primary).toBe(true);
  });

  it('marks resultToken as unique', () => {
    const columns = getTableColumns(checks);
    expect(columns.resultToken.isUnique).toBe(true);
  });

  it('has optional columns for Stripe + model tracking', () => {
    const columns = getTableColumns(checks);
    expect(columns.stripePaymentIntentId.notNull).toBe(false);
    expect(columns.modelProvider.notNull).toBe(false);
    expect(columns.modelId.notNull).toBe(false);
  });
});

describe('check_results table schema (Phase-2-A)', () => {
  it('has required scoring columns', () => {
    const columns = getTableColumns(checkResults);
    expect(columns.checkId).toBeDefined();
    expect(columns.criteriaScored).toBeDefined();
    expect(columns.totalScore).toBeDefined();
    expect(columns.tendency).toBeDefined();
    expect(columns.criteriaScores).toBeDefined();
  });

  it('marks check_id as notNull (FK)', () => {
    const columns = getTableColumns(checkResults);
    expect(columns.checkId.notNull).toBe(true);
  });

  it('makes rawLlmResponse optional (debug, purgeable)', () => {
    const columns = getTableColumns(checkResults);
    expect(columns.rawLlmResponse.notNull).toBe(false);
  });
});

// ── B1 Phase 1 — Free-Shot Funnel tables ─────────────────────────────────────

describe('email_verifications table schema (B1 Phase 1)', () => {
  it('exposes the expected columns', () => {
    const columns = getTableColumns(emailVerifications);
    expect(Object.keys(columns).sort()).toEqual([
      'bouncedAt',
      'confirmedAt',
      'createdAt',
      'emailHash',
      'expiresAt',
      'id',
      'status',
      'tokenHash',
    ]);
  });

  it('marks id as primary key', () => {
    expect(getTableColumns(emailVerifications).id.primary).toBe(true);
  });

  it('marks tokenHash unique + notNull', () => {
    const columns = getTableColumns(emailVerifications);
    expect(columns.tokenHash.isUnique).toBe(true);
    expect(columns.tokenHash.notNull).toBe(true);
  });

  it('requires emailHash and expiresAt', () => {
    const columns = getTableColumns(emailVerifications);
    expect(columns.emailHash.notNull).toBe(true);
    expect(columns.expiresAt.notNull).toBe(true);
  });

  it('makes confirmedAt and bouncedAt optional', () => {
    const columns = getTableColumns(emailVerifications);
    expect(columns.confirmedAt.notNull).toBe(false);
    expect(columns.bouncedAt.notNull).toBe(false);
  });
});

describe('email_subscribers table schema (B1 Phase 1)', () => {
  it('exposes the expected columns', () => {
    const columns = getTableColumns(emailSubscribers);
    expect(Object.keys(columns).sort()).toEqual([
      'audienceTag',
      'createdAt',
      'emailHash',
      'gdprMarketingOptIn',
      'id',
      'removedAt',
    ]);
  });

  it('marks id as primary key', () => {
    expect(getTableColumns(emailSubscribers).id.primary).toBe(true);
  });

  it('requires emailHash and gdprMarketingOptIn', () => {
    const columns = getTableColumns(emailSubscribers);
    expect(columns.emailHash.notNull).toBe(true);
    expect(columns.gdprMarketingOptIn.notNull).toBe(true);
  });

  it('makes removedAt optional (soft-delete / unsubscribe)', () => {
    expect(getTableColumns(emailSubscribers).removedAt.notNull).toBe(false);
  });
});

describe('rate_limits table schema (B1 Phase 1)', () => {
  it('exposes the expected columns', () => {
    const columns = getTableColumns(rateLimits);
    expect(Object.keys(columns).sort()).toEqual([
      'count',
      'id',
      'keyHash',
      'keyType',
      'windowStart',
    ]);
  });

  it('marks id as primary key', () => {
    expect(getTableColumns(rateLimits).id.primary).toBe(true);
  });

  it('requires keyHash, count and windowStart', () => {
    const columns = getTableColumns(rateLimits);
    expect(columns.keyHash.notNull).toBe(true);
    expect(columns.count.notNull).toBe(true);
    expect(columns.windowStart.notNull).toBe(true);
  });
});

describe('curated_examples table schema (B1 Phase 1)', () => {
  it('exposes the expected columns', () => {
    const columns = getTableColumns(curatedExamples);
    expect(Object.keys(columns).sort()).toEqual([
      'curatorNote',
      'id',
      'lastRerunAt',
      'publishedAt',
      'scoringResultJson',
      'slug',
      'url',
    ]);
  });

  it('marks id as primary key', () => {
    expect(getTableColumns(curatedExamples).id.primary).toBe(true);
  });

  it('marks url and slug unique + notNull', () => {
    const columns = getTableColumns(curatedExamples);
    expect(columns.url.isUnique).toBe(true);
    expect(columns.url.notNull).toBe(true);
    expect(columns.slug.isUnique).toBe(true);
    expect(columns.slug.notNull).toBe(true);
  });

  it('requires scoringResultJson, makes lastRerunAt optional', () => {
    const columns = getTableColumns(curatedExamples);
    expect(columns.scoringResultJson.notNull).toBe(true);
    expect(columns.lastRerunAt.notNull).toBe(false);
  });
});
