import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateEmail } from '../email-validator';
import { hasValidMx } from '../mx-lookup';

// 4-layer email validator composition. Layer 1 (disposable) runs against the
// REAL bundled blocklist; Layer 2 (MX) is mocked so the suite stays hermetic.
// Layers 3+4 (token, bounce) fire on later signals and are out of this unit.

vi.mock('../mx-lookup', () => ({ hasValidMx: vi.fn() }));
const mockHasValidMx = vi.mocked(hasValidMx);

describe('validateEmail (Layer 1 + 2 composition)', () => {
  beforeEach(() => {
    mockHasValidMx.mockReset();
    mockHasValidMx.mockResolvedValue({ valid: true });
  });

  it('rejects a disposable address at Layer 1 (and skips the MX lookup)', async () => {
    const result = await validateEmail('user@mailinator.com');

    expect(result).toEqual({ valid: false, layer: 1, reason: 'disposable' });
    expect(mockHasValidMx).not.toHaveBeenCalled();
  });

  it('rejects an address with no MX record at Layer 2', async () => {
    mockHasValidMx.mockResolvedValue({ valid: false, reason: 'no_mx' });

    const result = await validateEmail('user@gmial.com');

    expect(result).toEqual({ valid: false, layer: 2, reason: 'no_mx' });
  });

  it('accepts an address that passes Layers 1 + 2', async () => {
    mockHasValidMx.mockResolvedValue({ valid: true });

    const result = await validateEmail('user@gmail.com');

    expect(result).toEqual({ valid: true });
  });

  it('rejects a structurally malformed address before any layer', async () => {
    const result = await validateEmail('not-an-email');

    expect(result).toEqual({ valid: false, reason: 'malformed' });
    expect(mockHasValidMx).not.toHaveBeenCalled();
  });

  it('normalises domain case before the disposable check', async () => {
    const result = await validateEmail('User@MAILINATOR.com');

    expect(result.valid).toBe(false);
    expect(result.layer).toBe(1);
  });
});
