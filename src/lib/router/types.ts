/**
 * Input signals to the Router-Layer.
 * Plugin-Signal-Pattern: Phase-2 implements customer_explicit_deep_analysis + stake_indicator.
 * Phase-3 adds domain_classifier_label + tier1_confidence.
 */
export interface RouteSignals {
  customer_explicit_deep_analysis?: boolean;
  stake_indicator?: 'low' | 'medium' | 'high';
  // Phase-3 stubs (slot reserved):
  domain_classifier_label?: string;
  tier1_confidence?: number;
}

/**
 * Request context — who's asking and what tier they're on.
 */
export interface RouteContext {
  tier: 'free-shot' | 'standard' | 'deep' | 'sub-no-byok' | 'sub-byok';
  customer_id?: string;
  // Phase-3+ only — BYOK config from DB
  byok_config?: BYOKConfig;
}

/**
 * Phase-3 stub. Defined now for type-completeness.
 */
export interface BYOKConfig {
  provider: 'anthropic' | 'openai' | 'google';
  model_id: string;
  encrypted_key: string;
}

/**
 * Router output — what the workflow should execute.
 */
export interface RouteDecision {
  model_tier: 1 | 2;
  provider: 'anthropic' | 'openai' | 'google';
  model_id: string;
  key_source: 'shared' | 'byok';
  path: 'gateway' | 'direct';
  token_budget: TokenBudget;
  gateway_tags?: string[];
}

export interface TokenBudget {
  input_max: number;
  output_max: number;
}
