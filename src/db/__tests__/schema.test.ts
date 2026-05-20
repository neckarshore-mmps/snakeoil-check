import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { checkResults, checks, users } from '../schema';

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
