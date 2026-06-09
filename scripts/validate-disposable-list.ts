// CI-check: warn when the Layer-1 disposable blocklist snapshot is stale.
//
// Exit-code contract (plan: "warning if stale" — a warning, not a gate):
//   • staleness (>30d) / count-drift / version-drift → WARN, exit 0
//   • missing or corrupt meta snapshot → import throws → non-zero exit (hard fail)
//
// Count-drift means dependabot bumped `disposable-email-domains` but the meta
// wasn't regenerated — fix with: pnpm tsx scripts/generate-disposable-list.ts
import { createRequire } from 'node:module';
import { disposableListMeta, isListStale } from '../src/lib/email/disposable-detect';

const require = createRequire(import.meta.url);
const livePkg = require('disposable-email-domains/package.json') as {
  version: string;
};
const liveDomains = require('disposable-email-domains/index.json') as string[];

const now = new Date();
const regenHint = 'Regenerate: pnpm tsx scripts/generate-disposable-list.ts';
let warnings = 0;

if (isListStale(disposableListMeta.generatedAt, now, 30)) {
  console.warn(
    `⚠️  disposable blocklist snapshot is >30 days old (generatedAt=${disposableListMeta.generatedAt}). ${regenHint}`,
  );
  warnings++;
}

if (liveDomains.length !== disposableListMeta.count) {
  console.warn(
    `⚠️  installed list (${liveDomains.length}) differs from snapshot count (${disposableListMeta.count}) — package likely bumped. ${regenHint}`,
  );
  warnings++;
}

if (livePkg.version !== disposableListMeta.packageVersion) {
  console.warn(
    `⚠️  package version ${livePkg.version} != snapshot ${disposableListMeta.packageVersion}. ${regenHint}`,
  );
  warnings++;
}

if (warnings === 0) {
  console.log(
    `✓ disposable blocklist fresh: ${disposableListMeta.count} domains, generated ${disposableListMeta.generatedAt}, package v${disposableListMeta.packageVersion}`,
  );
}

process.exit(0);
