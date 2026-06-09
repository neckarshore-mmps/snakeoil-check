// Regenerates src/lib/email/disposable-list.meta.json — the freshness marker for
// the Layer-1 disposable-domain blocklist. The domain DATA itself lives in the
// version-pinned `disposable-email-domains` package (bundled at build, no runtime
// I/O); this script only records WHEN we last verified it + the package version +
// the domain count, so `validate-disposable-list.ts` can flag a stale list.
//
// Run: pnpm tsx scripts/generate-disposable-list.ts

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const domains = require('disposable-email-domains/index.json') as string[];
const pkg = require('disposable-email-domains/package.json') as { version: string };

const meta = {
  generatedAt: new Date().toISOString(),
  packageVersion: pkg.version,
  count: domains.length,
};

const target = fileURLToPath(
  new URL('../src/lib/email/disposable-list.meta.json', import.meta.url),
);
writeFileSync(target, `${JSON.stringify(meta, null, 2)}\n`);
console.log('Wrote disposable-list.meta.json:', meta);
