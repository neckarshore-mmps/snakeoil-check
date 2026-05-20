import { describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn((modelId: string) => `stub-anthropic:${modelId}`),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((modelId: string) => `stub-google:${modelId}`),
}));

import { createModelHandle } from '../gateway';

describe('createModelHandle', () => {
  it('returns a handle for anthropic provider', () => {
    const handle = createModelHandle({ provider: 'anthropic', model_id: 'claude-haiku-4.5' });
    expect(handle).toBe('stub-anthropic:claude-haiku-4.5');
  });

  it('returns a handle for google provider', () => {
    const handle = createModelHandle({ provider: 'google', model_id: 'gemini-2.0-flash' });
    expect(handle).toBe('stub-google:gemini-2.0-flash');
  });

  it('throws for unsupported provider (openai — valid type, runtime-only guard)', () => {
    expect(() => createModelHandle({ provider: 'openai', model_id: 'gpt-4o' })).toThrow(
      /not yet integrated/i,
    );
  });

  it('throws for unknown provider (runtime cast)', () => {
    expect(() =>
      createModelHandle({ provider: 'unsupported' as 'anthropic', model_id: 'x' }),
    ).toThrow(/unknown provider/i);
  });
});
