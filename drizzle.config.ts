import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env', override: false });

const connectionUrl = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionUrl) {
  throw new Error('POSTGRES_URL_NON_POOLING is required');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionUrl,
  },
  strict: true,
  verbose: true,
});
