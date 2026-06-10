// CI freshness check for the bundled disposable-email blocklist (Task 3.1).
//
// Reads the installed `disposable-email-domains` version, asks the npm
// registry when that version was published, and emits a GitHub Actions
// warning when it is older than 30 days. Warning-only by design: a stale
// blocklist degrades Layer-1 coverage but must never break the build, and
// a registry outage must not either (fail-open, exit 0 in both cases).
//
// Run: pnpm validate:disposable-list

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { BLOCKLIST_MAX_AGE_DAYS, isBlocklistStale } from '../src/lib/email/disposable-detect';

const PACKAGE = 'disposable-email-domains';
const REGISTRY_TIMEOUT_MS = 10_000;

function installedVersion(): string {
  // __filename (CJS) — tsx transpiles this repo to CJS (no "type": "module").
  const requireFromHere = createRequire(__filename);
  const pkgPath = requireFromHere.resolve(`${PACKAGE}/package.json`);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}

async function publishedAt(version: string): Promise<Date> {
  const res = await fetch(`https://registry.npmjs.org/${PACKAGE}`, {
    signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`registry responded ${res.status}`);
  }
  const data = (await res.json()) as { time?: Record<string, string> };
  const iso = data.time?.[version];
  if (!iso) {
    throw new Error(`no publish time for ${PACKAGE}@${version}`);
  }
  return new Date(iso);
}

async function main(): Promise<void> {
  const version = installedVersion();

  let published: Date;
  try {
    published = await publishedAt(version);
  } catch (err) {
    // Fail open: a freshness *check* must not fail the build on infra hiccups.
    console.log(
      `::warning::Could not verify ${PACKAGE} freshness (${err instanceof Error ? err.message : String(err)}) — skipping check.`,
    );
    return;
  }

  const ageDays = Math.floor((Date.now() - published.getTime()) / 86_400_000);

  if (isBlocklistStale(published, new Date())) {
    console.log(
      `::warning::Disposable-email blocklist ${PACKAGE}@${version} is ${ageDays} days old (max ${BLOCKLIST_MAX_AGE_DAYS}) — run \`pnpm update ${PACKAGE}\`.`,
    );
    return;
  }

  console.log(
    `Disposable-email blocklist ${PACKAGE}@${version} is fresh (${ageDays} days old, max ${BLOCKLIST_MAX_AGE_DAYS}).`,
  );
}

main().catch((err) => {
  // Last-resort fail-open — a freshness check must never break the build.
  console.log(`::warning::Disposable-list freshness check crashed: ${String(err)}`);
});
