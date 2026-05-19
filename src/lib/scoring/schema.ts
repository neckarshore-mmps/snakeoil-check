/**
 * Zod schema for AI structured output — Phase 2 plan §Task 2.3.
 *
 * Two variants:
 *   - FullCheckSchema      : all 12 criteria (used by both prompting strategies in Task 4)
 *   - FreeShotCheckSchema  : 5 criteria for the cost-reduced Free-Shot variant (Task 9)
 *
 * The `length(N)` constraint enforces the AI returns EXACTLY N items — if the
 * model drops or duplicates a criterion, Zod throws and the workflow step
 * retries (per Task 7). Task 4/7 additionally validate that every
 * `evidence_quote` is non-empty (the rubric requires verbatim evidence — see §4).
 */

import { z } from 'zod';
import { CRITERIA } from './criteria';

const CRITERION_IDS: ReadonlyArray<number> = CRITERIA.map((c) => c.id);
const FREE_SHOT_COUNT = CRITERIA.filter((c) => c.inFreeShot).length;

export const CriterionScoreSchema = z.object({
  criterion_id: z
    .number()
    .int()
    .refine((n) => CRITERION_IDS.includes(n), {
      message: `criterion_id must be one of ${CRITERION_IDS.join(',')}`,
    }),
  raw_score: z.number().int().min(0).max(10),
  evidence_quote: z.string().min(1).max(400),
  rationale: z.string().min(1).max(400),
});

export const FullCheckSchema = z.object({
  criteria: z.array(CriterionScoreSchema).length(CRITERIA.length),
});

export const FreeShotCheckSchema = z.object({
  criteria: z.array(CriterionScoreSchema).length(FREE_SHOT_COUNT), // 5
});
