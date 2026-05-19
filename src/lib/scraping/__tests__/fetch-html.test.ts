import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError, fetchHtml } from '../fetch-html';

const okHtml = '<html><head><title>OK</title></head><body><h1>Hi</h1></body></html>';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchHtml', () => {
  it('returns html for a 200 text/html response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(okHtml, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
    const r = await fetchHtml('https://example.test/x');
    expect(r.status).toBe(200);
    expect(r.html).toContain('<title>OK</title>');
    expect(r.truncated).toBe(false);
  });

  it('throws FetchError on non-HTML content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(fetchHtml('https://example.test/json')).rejects.toBeInstanceOf(FetchError);
  });

  it('throws FetchError on 4xx status after retries', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('nope', {
        status: 403,
        headers: { 'content-type': 'text/html' },
      }),
    );
    await expect(fetchHtml('https://example.test/forbidden')).rejects.toBeInstanceOf(FetchError);
  });
});
