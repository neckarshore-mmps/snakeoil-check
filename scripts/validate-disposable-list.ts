/**
 * CI-check: warn when the bundled disposable-email blocklist is stale.
 *
 * The `disposable-email-domains` package ships a static list; a list that has
 * not been refreshed in a while lets newly-spun-up throwaway domains through.
 * This script reads the installed version, asks the npm registry when that
 * version was published, and prints a warning if it is older than the
 * threshold.
 *
 * Warn-only by design: any failure (registry unreachable, parse error) prints a
 * notice and exits 0 — a best-effort freshness signal must never break CI.
 *
 * Run: pnpm tsx scripts/validate-disposable-list.ts
 */

import { createRequire } from 'node:module';

const PACKAGE_NAME = 'disposable-email-domains';
const MAX_AGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Pure decision: is `publishedAt` older than `maxAgeDays` relative to `now`? */
export function isListStale(publishedAt: Date, now: Date, maxAgeDays = MAX_AGE_DAYS): boolean {
  const ageDays = (now.getTime() - publishedAt.getTime()) / MS_PER_DAY;
  return ageDays > maxAgeDays;
}

interface RegistryMetadata {
  time?: Record<string, string>;
}

function installedVersion(): string {
  const nodeRequire = createRequire(import.meta.url);
  const pkg = nodeRequire(`${PACKAGE_NAME}/package.json`) as { version: string };
  return pkg.version;
}

async function publishedAtFor(version: string): Promise<Date | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}`);
    const data = (await res.json()) as RegistryMetadata;
    const stamp = data.time?.[version];
    return stamp ? new Date(stamp) : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const version = installedVersion();
  const publishedAt = await publishedAtFor(version);

  if (!publishedAt) {
    console.warn(
      `[validate-disposable-list] Could not determine publish date for ${PACKAGE_NAME}@${version} — skipping freshness check.`,
    );
    return;
  }

  const now = new Date();
  if (isListStale(publishedAt, now)) {
    const ageDays = Math.floor((now.getTime() - publishedAt.getTime()) / MS_PER_DAY);
    console.warn(
      `[validate-disposable-list] WARNING: ${PACKAGE_NAME}@${version} was published ${ageDays} days ago (> ${MAX_AGE_DAYS}d). Run \`pnpm update ${PACKAGE_NAME}\` to refresh the blocklist.`,
    );
  } else {
    console.log(`[validate-disposable-list] OK: ${PACKAGE_NAME}@${version} is fresh.`);
  }
}

// Only run the CLI when invoked directly (not when imported by the unit test).
if (process.argv[1]?.endsWith('validate-disposable-list.ts')) {
  void main();
}
