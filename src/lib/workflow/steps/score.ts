import { scoreSingleCall } from '../../ai/strategies/single-call';
import { checkBudget, makeRouteDecision } from '../../router';
import type { RouteSignals } from '../../router/types';
import type { NormalizedDoc } from '../../scraping/normalize';

export interface ScoreStepInput {
  doc: NormalizedDoc;
  tier: 'free-shot' | 'standard' | 'deep';
  signals: RouteSignals;
}

export interface ScoreStepOutput {
  criteria_scored: number;
  total_score: number;
  tendency: 'green' | 'amber' | 'red';
  criteria_scores: Array<{
    criterion_id: number;
    raw_score: number;
    rationale: string;
    evidence_quote: string;
  }>;
  warning_truncated: boolean;
  model_provider: string;
  model_id: string;
  token_usage: { input: number; output: number };
}

/**
 * Score step: route to correct model via Router-Layer, apply token budget,
 * run single-call AI scoring, map results to output shape.
 *
 * "use step" directive for Vercel Workflow SDK — no-op in Vitest.
 *
 * Plan divergence (documented): plan specifies scraped_content: string.
 * Actual: accepts NormalizedDoc for richer prompt-building via buildFullPrompt().
 * Budget check runs on doc.bodyText for token estimation.
 */
export async function scoreStep(input: ScoreStepInput): Promise<ScoreStepOutput> {
  'use step';

  const decision = makeRouteDecision(input.signals, { tier: input.tier });

  // Apply token budget to bodyText for truncation estimation
  const budgetTier =
    input.tier === 'deep' ? 'deep' : input.tier === 'free-shot' ? 'free-shot' : 'standard';
  const budgetResult = checkBudget(input.doc.bodyText, budgetTier);

  // If truncated, clone doc with truncated bodyText
  const scoringDoc: NormalizedDoc =
    budgetResult.warning != null
      ? { ...input.doc, bodyText: budgetResult.truncated_content, truncated: true }
      : input.doc;

  const result = await scoreSingleCall(scoringDoc, decision);

  const totalScore = result.scores.reduce((sum, s) => sum + s.rawScore, 0);
  const tendency: 'green' | 'amber' | 'red' =
    totalScore >= 75 ? 'green' : totalScore >= 45 ? 'amber' : 'red';

  return {
    criteria_scored: result.scores.length,
    total_score: totalScore,
    tendency,
    criteria_scores: result.scores.map((s) => ({
      criterion_id: s.criterionId,
      raw_score: s.rawScore,
      rationale: s.rationale,
      evidence_quote: s.evidenceQuote,
    })),
    warning_truncated: budgetResult.warning != null,
    model_provider: decision.provider,
    model_id: decision.model_id,
    token_usage: {
      input: result.inputTokens,
      output: result.outputTokens,
    },
  };
}
