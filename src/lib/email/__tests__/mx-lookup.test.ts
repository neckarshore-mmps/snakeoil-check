import { describe, expect, it } from 'vitest';
import { hasValidMx, MX_TIMEOUT_MS, type MxRecord } from '../mx-lookup';

// Email-Verify Layer 2 — MX lookup via injected resolver (unit-tier: fakes,
// integration-tier below: real DNS). Mirrors the inject-store pattern used by
// the anti-abuse Redis layers.

function fakeResolver(records: MxRecord[]) {
  return { resolveMx: async () => records };
}

function failingResolver(code: string) {
  return {
    resolveMx: async (): Promise<MxRecord[]> => {
      const err = new Error(code) as NodeJS.ErrnoException;
      err.code = code;
      throw err;
    },
  };
}

function hangingResolver() {
  return {
    resolveMx: () => new Promise<MxRecord[]>(() => {}),
  };
}

describe('hasValidMx (email-verify Layer 2, unit-tier)', () => {
  it('accepts a domain with MX records', async () => {
    const resolver = fakeResolver([{ exchange: 'mx1.example.com', priority: 10 }]);
    await expect(hasValidMx('gmail.com', { resolver })).resolves.toEqual({ valid: true });
  });

  it('rejects a domain whose lookup fails (typo domain, no MX record)', async () => {
    const resolver = failingResolver('ENOTFOUND');
    await expect(hasValidMx('gmial.com', { resolver })).resolves.toEqual({
      valid: false,
      reason: 'no_mx',
    });
  });

  it('rejects a domain with an empty MX record set', async () => {
    await expect(hasValidMx('example.com', { resolver: fakeResolver([]) })).resolves.toEqual({
      valid: false,
      reason: 'no_mx',
    });
  });

  it('rejects a null-MX domain (RFC 7505 — explicitly receives no mail)', async () => {
    const resolver = fakeResolver([{ exchange: '', priority: 0 }]);
    await expect(hasValidMx('nullmx.example', { resolver })).resolves.toEqual({
      valid: false,
      reason: 'no_mx',
    });
  });

  it('returns { valid: false, reason: "timeout" } when the lookup exceeds the deadline', async () => {
    const result = await hasValidMx('slow.example', {
      resolver: hangingResolver(),
      timeoutMs: 25,
    });
    expect(result).toEqual({ valid: false, reason: 'timeout' });
  });

  it('defaults the lookup deadline to 2s', () => {
    expect(MX_TIMEOUT_MS).toBe(2_000);
  });
});

describe('hasValidMx (integration-tier, real DNS)', () => {
  it('resolves real MX records for gmail.com', async () => {
    const result = await hasValidMx('gmail.com');
    expect(result).toEqual({ valid: true });
  });
});
