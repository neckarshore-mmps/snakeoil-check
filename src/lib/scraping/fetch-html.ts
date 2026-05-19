/**
 * HTTP fetcher for salespage HTML — Phase 2 plan §Task 3.1.
 *
 * Contract:
 *   - 30s hard timeout (AbortController)
 *   - 5 MB hard size cap (decoded prefix only; flagged via `truncated`)
 *   - 2 retries (p-retry), exponential backoff starting at 500ms
 *   - Follows redirects
 *   - Rejects non-HTML content-types
 *   - Custom UA: identifies SnakeOilCheck for site operators
 *
 * Errors: throws `FetchError` for any non-OK status, non-HTML response,
 * network error, or timeout. p-retry will re-attempt unless the error is
 * marked as non-retryable (4xx surfaces only after all retries exhausted).
 */

import pRetry from 'p-retry';

const FETCH_TIMEOUT_MS = 30_000;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const USER_AGENT =
  'Mozilla/5.0 (compatible; SnakeOilCheck/0.1; +https://snakeoil-check.vercel.app)';

export interface FetchResult {
  url: string; // final URL after redirects
  status: number;
  html: string;
  byteCount: number;
  truncated: boolean;
}

export class FetchError extends Error {
  override readonly cause?: unknown;
  constructor(msg: string, cause?: unknown) {
    super(msg);
    this.name = 'FetchError';
    this.cause = cause;
  }
}

export async function fetchHtml(input: string): Promise<FetchResult> {
  return pRetry(
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(input, {
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new FetchError(`status ${res.status} for ${input}`);
        }
        const ct = res.headers.get('content-type') ?? '';
        if (!/text\/html|application\/xhtml/i.test(ct)) {
          throw new FetchError(`non-HTML content-type "${ct}"`);
        }
        const body = await res.arrayBuffer();
        const truncated = body.byteLength >= MAX_SIZE_BYTES;
        const html = new TextDecoder('utf-8', { fatal: false }).decode(
          truncated ? body.slice(0, MAX_SIZE_BYTES) : body,
        );
        return {
          url: res.url,
          status: res.status,
          html,
          byteCount: body.byteLength,
          truncated,
        };
      } finally {
        clearTimeout(timer);
      }
    },
    { retries: 2, minTimeout: 500, factor: 2 },
  );
}
