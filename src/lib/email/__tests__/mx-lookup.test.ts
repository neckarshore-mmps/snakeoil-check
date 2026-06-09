import { describe, expect, it } from 'vitest';
import { hasValidMx, type MxResolver } from '../mx-lookup';

// Email-Verification Layer 2 — MX-record validation. The resolver is injected
// (DI, not a module mock) so the unit tier is deterministic + offline; the real
// `dns/promises.resolveMx` is the default in production. A live-DNS tier runs
// only when RUN_DNS_INTEGRATION=true (kept out of the default offline suite).

const okResolver: MxResolver = async () => [{ exchange: 'mx.example.com', priority: 10 }];
const emptyResolver: MxResolver = async () => [];
const notFoundResolver: MxResolver = async () => {
  const err = new Error('queryMx ENOTFOUND') as NodeJS.ErrnoException;
  err.code = 'ENOTFOUND';
  throw err;
};
const hangingResolver: MxResolver = () => new Promise(() => {}); // never settles

describe('hasValidMx — Layer 2 MX-record validation', () => {
  it('accepts a domain that has MX records', async () => {
    expect(await hasValidMx('gmail.com', { resolver: okResolver })).toEqual({
      valid: true,
    });
  });

  it('rejects a domain with no MX records (empty result)', async () => {
    expect(await hasValidMx('gmial.com', { resolver: emptyResolver })).toEqual({
      valid: false,
      reason: 'no_mx',
    });
  });

  it('treats ENOTFOUND / ENODATA as no_mx, not a transient error', async () => {
    expect(await hasValidMx('nope.invalid', { resolver: notFoundResolver })).toEqual({
      valid: false,
      reason: 'no_mx',
    });
  });

  it('returns timeout when the lookup exceeds the budget', async () => {
    expect(
      await hasValidMx('slow.example', {
        resolver: hangingResolver,
        timeoutMs: 30,
      }),
    ).toEqual({ valid: false, reason: 'timeout' });
  });

  it('returns error on an unexpected resolver failure (e.g. SERVFAIL)', async () => {
    const boom: MxResolver = async () => {
      throw new Error('SERVFAIL');
    };
    expect(await hasValidMx('x.example', { resolver: boom })).toEqual({
      valid: false,
      reason: 'error',
    });
  });

  it('rejects blank input as no_mx without a lookup', async () => {
    expect(await hasValidMx('   ', { resolver: okResolver })).toEqual({
      valid: false,
      reason: 'no_mx',
    });
  });
});

describe.runIf(process.env.RUN_DNS_INTEGRATION === 'true')(
  'hasValidMx — live DNS (integration tier)',
  () => {
    it('resolves real MX records for gmail.com', async () => {
      expect(await hasValidMx('gmail.com')).toEqual({ valid: true });
    });
  },
);
