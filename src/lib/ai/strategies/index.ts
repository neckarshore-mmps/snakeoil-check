/**
 * Strategy registry — Phase 2 plan §Task 4.5.
 *
 * Both strategies kept parameterized. `DEFAULT_STRATEGY` reflects the prior
 * from `scoring-framework.md §4` (single-call). Task 5 benchmark either
 * confirms this default or surfaces evidence to change it — in which case
 * both this constant AND `scoring-framework.md §4` flip in the same commit.
 */

import type { NormalizedDoc } from '../../scraping/normalize';
import { scorePerCriterion } from './per-criterion';
import type { StrategyResult } from './single-call';
import { scoreSingleCall } from './single-call';

export type StrategyName = 'single-call' | 'per-criterion';

export const SCORING_STRATEGIES: Record<
  StrategyName,
  (doc: NormalizedDoc) => Promise<StrategyResult>
> = {
  'single-call': scoreSingleCall,
  'per-criterion': scorePerCriterion,
};

export const DEFAULT_STRATEGY: StrategyName = 'single-call';

export type { StrategyResult } from './single-call';
