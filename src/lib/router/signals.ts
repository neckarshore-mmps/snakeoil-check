import type { RouteSignals } from './types';

/**
 * Plugin-Signal Tier-Selection.
 *
 * Phase-2 MVP: Implements Trigger B (Customer-Toggle) + Trigger D (Stake-Slider).
 * Phase-3 stubs (commented): Trigger A (Confidence) + Trigger C (Domain-Classifier).
 *
 * Returns 1 (Tier-1 Standard) by default. Returns 2 (Tier-2 Deep) when any
 * active trigger fires. Phase-3 stubs are slot-reserved but inactive.
 */
export function decideTier(signals: RouteSignals): 1 | 2 {
  // Trigger B — Customer explicitly requests Deep-Analysis
  if (signals.customer_explicit_deep_analysis === true) return 2;

  // Trigger D — Stake-Slider at high level
  if (signals.stake_indicator === 'high') return 2;

  // Phase-3 stubs (slot reserved, currently inactive):
  // Trigger C — Domain-Classifier
  // if (signals.domain_classifier_label === 'medical-claims') return 2
  // if (signals.domain_classifier_label === 'financial-claims') return 2

  // Trigger A — Tier-1 confidence post-first-call (escalation)
  // if (signals.tier1_confidence != null && signals.tier1_confidence < 0.5) return 2

  return 1;
}
