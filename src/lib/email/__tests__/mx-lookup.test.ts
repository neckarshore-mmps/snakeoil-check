import { resolveMx } from 'node:dns/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasValidMx, MX_LOOKUP_TIMEOUT_MS } from '../mx-lookup';

// Email-Verification Layer 2 — MX-record lookup.
// `node:dns/promises` is mocked so these assertions stay hermetic (no real DNS);
// the integration tier exercises live resolution separately.

vi.mock('node:dns/promises', () => ({ resolveMx: vi.fn() }));
const mockResolveMx = vi.mocked(resolveMx);

describe('hasValidMx (email Layer 2 — MX record lookup)', () => {
  beforeEach(() => {
    mockResolveMx.mockReset();
  });

  it('is valid when the domain has at least one MX record', async () => {
    mockResolveMx.mockResolvedValue([{ exchange: 'gmail-smtp-in.l.google.com', priority: 10 }]);

    const result = await hasValidMx('gmail.com');

    expect(result.valid).toBe(true);
    expect(mockResolveMx).toHaveBeenCalledWith('gmail.com');
  });

  it('is invalid (no_mx) when the domain has no MX record (typo domain)', async () => {
    const err = Object.assign(new Error('queryMx ENOTFOUND gmial.com'), { code: 'ENOTFOUND' });
    mockResolveMx.mockRejectedValue(err);

    const result = await hasValidMx('gmial.com');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no_mx');
  });

  it('is invalid (no_mx) when the lookup resolves an empty record set', async () => {
    mockResolveMx.mockResolvedValue([]);

    const result = await hasValidMx('no-mx.example');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no_mx');
  });

  it('times out (reason: timeout) when the lookup outruns its budget', async () => {
    mockResolveMx.mockImplementation(() => new Promise(() => {})); // never settles

    const result = await hasValidMx('slow.example', { timeoutMs: 20 });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('timeout');
  });

  it('defaults the lookup budget to 2000ms', () => {
    expect(MX_LOOKUP_TIMEOUT_MS).toBe(2000);
  });
});
