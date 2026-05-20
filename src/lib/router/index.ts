import { getTokenBudget } from './budget';
import { loadRouterConfig } from './config';
import { decidePath } from './path';
import { decideTier } from './signals';
import type { RouteContext, RouteDecision, RouteSignals } from './types';

export { checkBudget, estimateTokens, getTokenBudget, truncateToTokens } from './budget';
export { loadRouterConfig } from './config';
export { decidePath } from './path';
export { decideTier } from './signals';
export * from './types';

/**
 * Main entry-point: take signals + context, return decision.
 *
 * Composition: tier-selection → path-selection → model+provider lookup
 *              from env-config → budget per tier → gateway-tags.
 */
export function makeRouteDecision(signals: RouteSignals, context: RouteContext): RouteDecision {
  const config = loadRouterConfig();

  // Free-shot is special: always uses freeshot config, never escalates
  if (context.tier === 'free-shot') {
    return {
      model_tier: 1,
      provider: config.freeshot.provider,
      model_id: config.freeshot.model_id,
      key_source: 'shared',
      path: 'gateway',
      token_budget: getTokenBudget('free-shot'),
      gateway_tags: ['feature:snake-oil-check', 'tier:free-shot'],
    };
  }

  // Paid tiers: signals decide tier-1 vs tier-2
  const tier = decideTier(signals);
  const path = decidePath(context);
  const modelConfig = tier === 1 ? config.tier1 : config.tier2;
  const budget_tier = tier === 1 ? 'standard' : 'deep';

  return {
    model_tier: tier,
    provider: modelConfig.provider,
    model_id: modelConfig.model_id,
    key_source: context.byok_config ? 'byok' : 'shared',
    path,
    token_budget: getTokenBudget(budget_tier),
    gateway_tags: ['feature:snake-oil-check', `tier:${context.tier}`, `model_tier:${tier}`],
  };
}
