import { db } from '../../../db';
import { checkResults, checks } from '../../../db/schema';
import type { ScoreStepOutput } from './score';
import type { ScrapeStepOutput } from './scrape';

export interface PersistStepInput {
  url: string;
  tier: 'free-shot' | 'standard' | 'deep';
  scrape: ScrapeStepOutput;
  score: ScoreStepOutput;
}

export interface PersistStepOutput {
  check_id: string;
  result_token: string;
}

/**
 * Persist step: write check + check_results rows to Neon Postgres via Drizzle.
 *
 * "use step" directive for Vercel Workflow SDK — no-op in Vitest.
 *
 * Plan divergence (documented): plan specifies `import { db } from '../../db'`.
 * Actual path from steps/persist.ts → ../../../db (3 levels: steps → workflow → lib → db).
 */
export async function persistStep(input: PersistStepInput): Promise<PersistStepOutput> {
  'use step';

  // Normalize URL: lowercase + strip trailing slash
  const urlNormalized = input.scrape.url.toLowerCase().replace(/\/$/, '');

  // Insert check row
  const [check] = await db
    .insert(checks)
    .values({
      url: input.url,
      urlNormalized,
      tier: input.tier,
      paymentStatus: input.tier === 'free-shot' ? 'not-required' : 'paid',
      scrapeStatus: 'done',
      workflowStatus: 'done',
      modelProvider: input.score.model_provider,
      modelId: input.score.model_id,
      tokenBudgetUsedInput: input.score.token_usage.input,
      tokenBudgetUsedOutput: input.score.token_usage.output,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30d
    })
    .returning();

  if (!check) {
    throw new Error('DB insert returned empty result for checks table');
  }

  // Insert result row
  await db.insert(checkResults).values({
    checkId: check.id,
    criteriaScored: input.score.criteria_scored,
    totalScore: input.score.total_score,
    tendency: input.score.tendency,
    criteriaScores: input.score.criteria_scores,
    warningTruncated: input.score.warning_truncated,
  });

  return {
    check_id: check.id,
    result_token: check.resultToken,
  };
}
