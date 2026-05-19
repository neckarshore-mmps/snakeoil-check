/**
 * Scoring types — Phase 2 plan §Task 2.1.
 *
 * The shape of every scored Check. `docs/scoring-framework.md` §2 + §3 defines
 * the rubric; this file encodes the resulting TypeScript shape. Keep in sync
 * with `criteria.ts` (one source of truth for the 12 criteria) and
 * `schema.ts` (Zod schema for AI structured output).
 */

export type Pillar = 'substance' | 'trust' | 'pricing' | 'risk';

export interface Criterion {
  readonly id: number; // 1..12
  readonly pillar: Pillar;
  readonly name: string;
  readonly weight: number; // 4..9 per §2
  readonly rubricRef: string; // e.g. '§3.1' — points back to scoring-framework.md
  readonly inFreeShot: boolean; // true for IDs in [1, 4, 7, 10, 11] per §4 Free-Shot
}

export interface CriterionScore {
  readonly criterionId: number;
  readonly rawScore: number; // 0..10 per rubric
  readonly evidenceQuote: string; // verbatim or '[no statement found]'
  readonly rationale: string; // 1–2 sentences
}

export interface CheckScore {
  readonly url: string;
  readonly rubricVersion: string; // semver, see §7
  readonly criterionScores: ReadonlyArray<CriterionScore>;
  readonly weightedTotal: number;
  readonly tendency: 'Go' | 'Vorsicht' | 'Lieber lassen';
  readonly modelStrategy: 'single-call' | 'per-criterion';
  readonly latencyMs: number;
  readonly costEur: number;
}
