import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { users } from '../schema';

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
