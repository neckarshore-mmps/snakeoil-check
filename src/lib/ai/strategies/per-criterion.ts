/**
 * Per-criterion scoring strategy — Phase 2 plan §Task 4.4.
 *
 * 12 parallel `generateObject` calls, one per criterion. Each call uses a
 * length(1) schema so the model returns exactly one criterion_score object.
 * Higher cost (~12× tokens) and higher latency (~5–10× wall-clock) than
 * single-call, traded for potentially better per-criterion isolation.
 *
 * Existence post-Task-5: even if the benchmark picks single-call, this
 * strategy stays parameterized as a calibration-time and regression
 * fallback. Not deleted.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { CRITERIA } from '../../scoring/criteria';
import { CriterionScoreSchema } from '../../scoring/schema';
import type { CriterionScore } from '../../scoring/types';
import type { NormalizedDoc } from '../../scraping/normalize';
import { MODEL_LABEL, MODEL_TEMPERATURE, scorerModel } from '../gateway';
import { buildSingleCriterionPrompt } from '../prompts';
import type { StrategyResult } from './single-call';

const SingleCriterionResponse = z.object({
  criteria: z.array(CriterionScoreSchema).length(1),
});

// Zod 4 vs ai-SDK 4 type-inference: see strategies/single-call.ts for context.
type SingleCriterionResult = z.infer<typeof SingleCriterionResponse>;

export async function scorePerCriterion(doc: NormalizedDoc): Promise<StrategyResult> {
  const start = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;

  const results = await Promise.all(
    CRITERIA.map(async (c) => {
      const { system, user } = buildSingleCriterionPrompt(doc, c.id);
      const r = await generateObject({
        model: scorerModel,
        system,
        prompt: user,
        schema: SingleCriterionResponse,
        temperature: MODEL_TEMPERATURE,
      });
      inputTokens += r.usage?.promptTokens ?? 0;
      outputTokens += r.usage?.completionTokens ?? 0;
      const parsed = r.object as SingleCriterionResult;
      const item = parsed.criteria[0];
      if (!item) {
        // SingleCriterionResponse enforces length(1) at runtime via Zod —
        // this guard is purely for TypeScript's noUncheckedIndexedAccess.
        throw new Error(`Empty criteria array for criterion id ${c.id}`);
      }
      return {
        criterionId: item.criterion_id,
        rawScore: item.raw_score,
        evidenceQuote: item.evidence_quote,
        rationale: item.rationale,
      } satisfies CriterionScore;
    }),
  );

  const scores = results.sort((a, b) => a.criterionId - b.criterionId);
  return {
    scores,
    model: MODEL_LABEL,
    latencyMs: Date.now() - start,
    inputTokens,
    outputTokens,
  };
}
