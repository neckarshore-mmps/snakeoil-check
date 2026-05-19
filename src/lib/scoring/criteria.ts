/**
 * Frozen criterion table — Phase 2 plan §Task 2.2.
 *
 * One source of truth for the 12 criteria from `docs/scoring-framework.md` §2.
 * Both the TypeScript shape (`types.ts`) and the Zod schema (`schema.ts`)
 * derive from this table. Bumping the rubric requires:
 *   1. Edit this file
 *   2. Bump `RUBRIC_VERSION` per semver (per §7)
 *   3. Update tests in `__tests__/criteria.test.ts`
 *   4. Surface in changelog before next AI run
 */

import type { Criterion } from './types';

const FREE_SHOT_IDS = new Set<number>([1, 4, 7, 10, 11]);

export const CRITERIA: ReadonlyArray<Criterion> = Object.freeze([
  {
    id: 1,
    pillar: 'substance',
    name: 'Specificity of Promises',
    weight: 8,
    rubricRef: '§3.1',
    inFreeShot: FREE_SHOT_IDS.has(1),
  },
  {
    id: 2,
    pillar: 'substance',
    name: 'Methodology Transparency',
    weight: 7,
    rubricRef: '§3.2',
    inFreeShot: FREE_SHOT_IDS.has(2),
  },
  {
    id: 3,
    pillar: 'substance',
    name: 'Outcome Measurability',
    weight: 6,
    rubricRef: '§3.3',
    inFreeShot: FREE_SHOT_IDS.has(3),
  },
  {
    id: 4,
    pillar: 'trust',
    name: 'Provider Track Record',
    weight: 8,
    rubricRef: '§3.4',
    inFreeShot: FREE_SHOT_IDS.has(4),
  },
  {
    id: 5,
    pillar: 'trust',
    name: 'Testimonial Authenticity',
    weight: 7,
    rubricRef: '§3.5',
    inFreeShot: FREE_SHOT_IDS.has(5),
  },
  {
    id: 6,
    pillar: 'trust',
    name: 'Independent Verifiability',
    weight: 6,
    rubricRef: '§3.6',
    inFreeShot: FREE_SHOT_IDS.has(6),
  },
  {
    id: 7,
    pillar: 'pricing',
    name: 'Price-to-Value Transparency',
    weight: 8,
    rubricRef: '§3.7',
    inFreeShot: FREE_SHOT_IDS.has(7),
  },
  {
    id: 8,
    pillar: 'pricing',
    name: 'Refund / Cancellation Policy',
    weight: 5,
    rubricRef: '§3.8',
    inFreeShot: FREE_SHOT_IDS.has(8),
  },
  {
    id: 9,
    pillar: 'pricing',
    name: 'Pricing-Logic Coherence',
    weight: 5,
    rubricRef: '§3.9',
    inFreeShot: FREE_SHOT_IDS.has(9),
  },
  {
    id: 10,
    pillar: 'risk',
    name: 'Urgency / Pressure Tactics',
    weight: 7,
    rubricRef: '§3.10',
    inFreeShot: FREE_SHOT_IDS.has(10),
  },
  {
    id: 11,
    pillar: 'risk',
    name: 'Income / Outcome Claims',
    weight: 9,
    rubricRef: '§3.11',
    inFreeShot: FREE_SHOT_IDS.has(11),
  },
  {
    id: 12,
    pillar: 'risk',
    name: 'Target-Audience Specificity',
    weight: 4,
    rubricRef: '§3.12',
    inFreeShot: FREE_SHOT_IDS.has(12),
  },
] satisfies ReadonlyArray<Criterion>);

export const MAX_RAW_SCORE = 10;
export const MAX_WEIGHTED_TOTAL = CRITERIA.reduce((sum, c) => sum + c.weight * MAX_RAW_SCORE, 0); // 800

export const RUBRIC_VERSION = '0.1.0' as const;

export function tendencyFor(weightedTotal0to100: number): 'Go' | 'Vorsicht' | 'Lieber lassen' {
  if (weightedTotal0to100 >= 75) return 'Go';
  if (weightedTotal0to100 >= 45) return 'Vorsicht';
  return 'Lieber lassen';
}

export function computeWeightedTotal(
  scores: ReadonlyArray<{ criterionId: number; rawScore: number }>,
): number {
  const weighted = scores.reduce((sum, s) => {
    const c = CRITERIA.find((x) => x.id === s.criterionId);
    if (!c) throw new Error(`Unknown criterion id ${s.criterionId}`);
    return sum + s.rawScore * c.weight;
  }, 0);
  return (weighted / MAX_WEIGHTED_TOTAL) * 100;
}
