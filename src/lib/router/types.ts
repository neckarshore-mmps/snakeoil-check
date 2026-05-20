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
  // PHASE-3 TIME BOMB (per Dr. Sommer F-NEW-2 2026-05-20-d):
  // `sub-no-byok` and `sub-byok` are NOT in checkTierEnum (src/db/schema.ts).
  // Safe today because SnakeOilCheckInput.tier is narrowed to free-shot|standard|deep.
  // When Phase-3 introduces sub-tier in workflow input, this WILL cause Postgres
  // enum violation in persistStep. Required action at Phase-3 launch:
  //   (a) DB migration extending checkTierEnum to include sub-no-byok + sub-byok
  //   (b) Simultaneously widen SnakeOilCheckInput.tier
  //   (c) Optionally add runtime guard in persistStep validating input.tier against enum
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
