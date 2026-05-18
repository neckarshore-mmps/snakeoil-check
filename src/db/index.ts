import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Lazy initialization so build-time `Collecting page data`
// does not evaluate this module's env-check (DATABASE_URL is
// a runtime requirement, not build-time).
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getDb() {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  const pool = new Pool({ connectionString });
  _db = drizzle(pool, { schema });
  return _db;
}

// Proxy preserves the `import { db } from '@/db'` API while
// deferring all property access (and thus the env-check) to
// first use at request-time.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Db = ReturnType<typeof drizzle<typeof schema>>;
