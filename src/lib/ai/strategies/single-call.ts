/**
 * Single-call scoring strategy — Phase 2 plan §Task 4.3.
 *
 * One `generateObject` call returns all 12 criterion scores in one shot.
 * Per `scoring-framework.md §4`, this is the PRIOR: ~70% token savings via
 * shared context, ~10–15s latency vs ~60s for per-criterion, consistency
 * across criteria from full-document grounding.
 *
 * Task 5 benchmark validates this prior empirically. If disagreement
 * between strategies exceeds 5pt average, STOP and investigate (per
 * §8 #1 framing in the plan-doc).
 */

import { generateObject } from 'ai';
import type { z } from 'zod';
import type { RouteDecision } from '../../router/types';
import { FullCheckSchema } from '../../scoring/schema';
import type { CriterionScore } from '../../scoring/types';
import type { NormalizedDoc } from '../../scraping/normalize';
import { createModelHandle, MODEL_LABEL, MODEL_TEMPERATURE, scorerModel } from '../gateway';
import { buildFullPrompt } from '../prompts';

// Zod 4 vs ai-SDK 4 type-inference: the SDK's peerDep is "zod": "^3.23.8"
// while this codebase uses zod 4. Runtime works (schema.parse is API-stable
// across v3/v4), but TypeScript inference on result.object falls back to
// unknown. Narrow at the boundary; the schema enforces shape at runtime.
type FullCheckResult = z.infer<typeof FullCheckSchema>;

export interface StrategyResult {
  scores: ReadonlyArray<CriterionScore>;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Single-call scoring strategy.
 *
 * Phase-2-A: accepts optional routeDecision for Router-Layer model selection.
 * When routeDecision is provided, uses createModelHandle() for the specified
 * provider/model. Without it, falls back to legacy scorerModel (Sonnet 4.5).
 */
export async function scoreSingleCall(
  doc: NormalizedDoc,
  routeDecision?: RouteDecision,
): Promise<StrategyResult> {
  const model = routeDecision
    ? createModelHandle({ provider: routeDecision.provider, model_id: routeDecision.model_id })
    : scorerModel;
  const modelLabel = routeDecision
    ? `${routeDecision.provider}/${routeDecision.model_id}`
    : MODEL_LABEL;

  const { system, user } = buildFullPrompt(doc);
  const start = Date.now();
  const result = await generateObject({
    model,
    system,
    prompt: user,
    schema: FullCheckSchema,
    temperature: MODEL_TEMPERATURE,
  });
  const latencyMs = Date.now() - start;
  const parsed = result.object as FullCheckResult;
  const scores: CriterionScore[] = parsed.criteria.map((c) => ({
    criterionId: c.criterion_id,
    rawScore: c.raw_score,
    evidenceQuote: c.evidence_quote,
    rationale: c.rationale,
  }));
  return {
    scores,
    model: modelLabel,
    latencyMs,
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
  };
}
