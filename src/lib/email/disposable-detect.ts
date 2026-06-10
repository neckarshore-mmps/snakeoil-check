// Email-Verification Layer 1 — disposable-domain detection.
//
// A build-time-bundled blocklist (`disposable-email-domains`, ~121k domains)
// is loaded once into a Set for O(1), I/O-free membership checks — safe to call
// in the request path. This is Layer 1 of the 4-layer email validator.
//
// The list is pulled via `createRequire` (typed as string[]) rather than a
// static JSON import on purpose: a 2.4 MB `import … from '*.json'` would force
// tsc to infer a 121k-entry literal type and choke. We never want that giant
// literal in the type graph — only the values at runtime.

import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const BLOCKLIST: ReadonlySet<string> = new Set(nodeRequire('disposable-email-domains') as string[]);

/**
 * True if `domain` is a known disposable / throwaway email provider.
 *
 * @param domain Bare email domain (e.g. 'mailinator.com'). Case and surrounding
 *               whitespace are normalised before the lookup, since real form
 *               input arrives mixed-case and padded.
 */
export function isDisposable(domain: string): boolean {
  return BLOCKLIST.has(domain.trim().toLowerCase());
}
