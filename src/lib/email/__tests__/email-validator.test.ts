import { describe, expect, it } from 'vitest';
import { validateEmail } from '../email-validator';
import type { MxRecord } from '../mx-lookup';

// Email-Verify composition — Layer 1 (disposable) + Layer 2 (MX) run
// synchronously at submit; Layers 3+4 (IP rate-limit, bounce) happen at later
// signals. Resolver injected so the unit tier never hits real DNS.

function fakeResolver(records: MxRecord[]) {
  let called = false;
  return {
    resolver: {
      resolveMx: async () => {
        called = true;
        return records;
      },
    },
    wasCalled: () => called,
  };
}

const notFoundResolver = {
  resolveMx: async (): Promise<MxRecord[]> => {
    const err = new Error('ENOTFOUND') as NodeJS.ErrnoException;
    err.code = 'ENOTFOUND';
    throw err;
  },
};

const GMAIL_MX = [{ exchange: 'gmail-smtp-in.l.google.com', priority: 5 }];

describe('validateEmail (Layer 1+2 composition)', () => {
  it('blocks a disposable domain at layer 1 without touching DNS', async () => {
    const { resolver, wasCalled } = fakeResolver(GMAIL_MX);
    const result = await validateEmail('user@mailinator.com', { resolver });

    expect(result).toEqual({ valid: false, layer: 1, reason: 'disposable' });
    expect(wasCalled()).toBe(false); // layer 1 short-circuits
  });

  it('blocks a typo domain without MX records at layer 2', async () => {
    await expect(validateEmail('user@gmial.com', { resolver: notFoundResolver })).resolves.toEqual({
      valid: false,
      layer: 2,
      reason: 'no_mx',
    });
  });

  it('passes a legitimate address once layers 1+2 clear (3+4 deferred)', async () => {
    const { resolver } = fakeResolver(GMAIL_MX);
    await expect(validateEmail('user@gmail.com', { resolver })).resolves.toEqual({
      valid: true,
    });
  });

  it('surfaces an MX deadline overrun as layer 2 timeout', async () => {
    const hanging = { resolveMx: () => new Promise<MxRecord[]>(() => {}) };
    await expect(
      validateEmail('user@gmail.com', { resolver: hanging, timeoutMs: 25 }),
    ).resolves.toEqual({ valid: false, layer: 2, reason: 'timeout' });
  });

  it('rejects a malformed address before any layer runs', async () => {
    const { resolver, wasCalled } = fakeResolver(GMAIL_MX);
    await expect(validateEmail('not-an-email', { resolver })).resolves.toEqual({
      valid: false,
      layer: 1,
      reason: 'invalid_format',
    });
    expect(wasCalled()).toBe(false);
  });

  it('normalizes case and whitespace before checking', async () => {
    const { resolver } = fakeResolver(GMAIL_MX);
    await expect(validateEmail('  User@MAILINATOR.COM ', { resolver })).resolves.toEqual({
      valid: false,
      layer: 1,
      reason: 'disposable',
    });
  });
});
