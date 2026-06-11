import type { VercelConfig } from '@vercel/config/v1';

const config: VercelConfig = {
  buildCommand: 'pnpm build',
  installCommand: 'pnpm install --frozen-lockfile',
  framework: 'nextjs',
  // Nightly purge of expired checks (GDPR F-NOW-2, Art. 5(1)(e) storage
  // limitation). 03:17 UTC — off-peak, non-round minute. Vercel invokes the
  // route with `Authorization: Bearer ${CRON_SECRET}`.
  crons: [{ path: '/api/cron/purge-expired', schedule: '17 3 * * *' }],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

export default config;
