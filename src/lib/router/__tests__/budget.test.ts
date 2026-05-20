import { describe, expect, it } from 'vitest';
import { checkBudget, estimateTokens, getTokenBudget, truncateToTokens } from '../budget';

describe('getTokenBudget', () => {
  it('returns free-shot budget (tight)', () => {
    expect(getTokenBudget('free-shot')).toEqual({
      input_max: 10_000,
      output_max: 1_500,
    });
  });

  it('returns tier-1 budget (standard)', () => {
    expect(getTokenBudget('standard')).toEqual({
      input_max: 30_000,
      output_max: 3_000,
    });
  });

  it('returns tier-2 budget (deep)', () => {
    expect(getTokenBudget('deep')).toEqual({
      input_max: 50_000,
      output_max: 5_000,
    });
  });

  it('throws for unknown tier', () => {
    expect(() => getTokenBudget('unknown')).toThrow(/unknown tier/i);
  });
});

describe('estimateTokens', () => {
  it('estimates ~1 token per 4 chars', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → ceil = 3
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles large input', () => {
    const text = 'a'.repeat(40_000);
    expect(estimateTokens(text)).toBe(10_000);
  });
});

describe('truncateToTokens', () => {
  it('returns input unchanged if within budget', () => {
    const input = 'hello world';
    expect(truncateToTokens(input, 100)).toBe(input);
  });

  it('truncates to roughly max_tokens × 4 chars', () => {
    const input = 'a'.repeat(1000);
    const result = truncateToTokens(input, 100);
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('handles empty input', () => {
    expect(truncateToTokens('', 100)).toBe('');
  });
});

describe('checkBudget', () => {
  it('returns ok with original content when within budget', () => {
    const content = 'a'.repeat(1000); // ~250 tokens
    const result = checkBudget(content, 'standard');
    expect(result.ok).toBe(true);
    expect(result.truncated_content).toBe(content);
    expect(result.warning).toBeUndefined();
  });

  it('returns ok with truncated content + warning when over budget', () => {
    const content = 'a'.repeat(200_000); // 50K tokens, well over 30K tier-1
    const result = checkBudget(content, 'standard');
    expect(result.ok).toBe(true);
    expect(result.truncated_content.length).toBeLessThanOrEqual(120_000); // 30K * 4
    expect(result.warning).toMatch(/truncated/i);
  });
});
