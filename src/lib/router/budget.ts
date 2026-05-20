import type { TokenBudget } from './types';

const TOKEN_BUDGETS: Record<string, TokenBudget> = {
  'free-shot': { input_max: 10_000, output_max: 1_500 },
  standard: { input_max: 30_000, output_max: 3_000 },
  deep: { input_max: 50_000, output_max: 5_000 },
};

export function getTokenBudget(tier: string): TokenBudget {
  const budget = TOKEN_BUDGETS[tier];
  if (!budget) {
    throw new Error(`Unknown tier "${tier}". Valid: ${Object.keys(TOKEN_BUDGETS).join(', ')}`);
  }
  return budget;
}

/**
 * Rough token-count estimate: ~1 token per 4 chars (English heuristic).
 * Accurate enough for budget-guards; not a substitute for real tokenizer counts.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToTokens(text: string, max_tokens: number): string {
  const max_chars = max_tokens * 4;
  if (text.length <= max_chars) return text;
  return text.slice(0, max_chars);
}

interface BudgetCheckResult {
  ok: boolean;
  truncated_content: string;
  warning?: string;
}

export function checkBudget(
  content: string,
  tier: 'free-shot' | 'standard' | 'deep',
): BudgetCheckResult {
  const budget = getTokenBudget(tier);
  const estimated = estimateTokens(content);

  if (estimated <= budget.input_max) {
    return { ok: true, truncated_content: content };
  }

  const truncated = truncateToTokens(content, budget.input_max);
  return {
    ok: true,
    truncated_content: truncated,
    warning: `Content was ${estimated} tokens, truncated to ${budget.input_max} for ${tier} analysis.`,
  };
}
