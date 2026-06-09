import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '../turnstile';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const mockFetch = vi.fn();

describe('verifyTurnstileToken (anti-abuse Layer 1)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it('POSTs secret + response token to siteverify and returns success + cdata', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ success: true, cdata: 'session-abc' }) });

    const result = await verifyTurnstileToken('good-token', '203.0.113.7');

    expect(result.success).toBe(true);
    expect(result.cdata).toBe('session-abc');
    expect(mockFetch).toHaveBeenCalledOnce();
    const firstCall = mockFetch.mock.calls[0];
    if (!firstCall) throw new Error('expected fetch to have been called');
    const [url, init] = firstCall;
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('test-secret');
    expect(body.get('response')).toBe('good-token');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('returns success:false + errorCodes for an expired/duplicate token', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    });

    const result = await verifyTurnstileToken('stale-token');

    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(['timeout-or-duplicate']);
  });

  it('omits remoteip when not provided', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ success: true }) });

    await verifyTurnstileToken('tok');

    const firstCall = mockFetch.mock.calls[0];
    if (!firstCall) throw new Error('expected fetch to have been called');
    const body = firstCall[1].body as URLSearchParams;
    expect(body.has('remoteip')).toBe(false);
  });

  it('fails closed (success:false) when siteverify is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await verifyTurnstileToken('tok');

    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('network-error');
  });

  it('throws when TURNSTILE_SECRET_KEY is missing (config error, surfaced loudly)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(verifyTurnstileToken('tok')).rejects.toThrow(/TURNSTILE_SECRET_KEY/);
  });
});
