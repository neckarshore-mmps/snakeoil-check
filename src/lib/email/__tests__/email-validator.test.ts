import { describe, expect, it } from 'vitest';
import { validateEmail } from '../email-validator';
import type { MxResolver } from '../mx-lookup';

// Synchronous front of the 4-layer pipeline: Layer 1 (disposable) + Layer 2 (MX).
// Layers 3 (IP rate-limit) + 4 (bounce webhook) fire at later signals, not here.
// The resolver is injected so the unit tier does no real DNS.

const mxOk: MxResolver = async () => [{ exchange: 'mx.example.com', priority: 10 }];
const mxNone: MxResolver = async () => [];

describe('validateEmail — Layer 1+2 composition', () => {
  it('rejects a disposable domain at Layer 1', async () => {
    expect(await validateEmail('user@mailinator.com', { resolver: mxOk })).toEqual({
      valid: false,
      layer: 1,
      reason: 'disposable',
    });
  });

  it('rejects a domain with no MX records at Layer 2', async () => {
    expect(await validateEmail('user@gmial.com', { resolver: mxNone })).toEqual({
      valid: false,
      layer: 2,
      reason: 'no_mx',
    });
  });

  it('accepts a legit domain that passes both layers', async () => {
    expect(await validateEmail('user@gmail.com', { resolver: mxOk })).toEqual({
      valid: true,
    });
  });

  it('rejects a malformed address before running any layer', async () => {
    expect(await validateEmail('not-an-email', { resolver: mxOk })).toEqual({
      valid: false,
      layer: 0,
      reason: 'invalid_format',
    });
  });

  it('short-circuits: no MX lookup when Layer 1 already rejects', async () => {
    let called = false;
    const spy: MxResolver = async () => {
      called = true;
      return [];
    };
    await validateEmail('throwaway@mailinator.com', { resolver: spy });
    expect(called).toBe(false);
  });

  it('surfaces the MX timeout reason at Layer 2', async () => {
    const hang: MxResolver = () => new Promise(() => {});
    expect(await validateEmail('user@slow.example', { resolver: hang, timeoutMs: 20 })).toEqual({
      valid: false,
      layer: 2,
      reason: 'timeout',
    });
  });
});
