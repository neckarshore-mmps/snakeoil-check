import type { RouteSignals } from '../router/types';
import { persistStep } from './steps/persist';
import { scoreStep } from './steps/score';
import { scrapeStep } from './steps/scrape';

export interface SnakeOilCheckInput {
  url: string;
  tier: 'free-shot' | 'standard' | 'deep';
  signals: RouteSignals;
}

export interface SnakeOilCheckOutput {
  workflow_status: 'done' | 'failed';
  check_id?: string;
  result_token?: string;
  error?: string;
}

/**
 * Durable Snake-Oil-or-Gold Check workflow.
 *
 * Orchestrates: scrape → score (AI via Router-Layer) → persist.
 *
 * "use workflow" directive: Vercel Workflow SDK transforms this function at
 * build-time (via withWorkflow() in next.config.ts) into a durable,
 * resumable workflow. Each "use step" function runs as a separate resumable
 * task — if the Vercel function times out mid-workflow, execution resumes
 * from the last completed step.
 *
 * In Vitest (no build transform): all directives are no-op string literals,
 * the function runs as a regular async function. Mocked steps run inline.
 *
 * Trigger via: import { start } from 'workflow/api'; await start(runSnakeOilCheckWorkflow, [input])
 *
 * Plan divergence (documented): plan uses workflow({name, retry}, fn) pattern.
 * Actual: "use workflow" directive per workflow@4.2.4 API.
 */
export async function runSnakeOilCheckWorkflow(
  input: SnakeOilCheckInput,
): Promise<SnakeOilCheckOutput> {
  'use workflow';

  try {
    // Step 1: Scrape URL → NormalizedDoc
    const scrape = await scrapeStep({ url: input.url });

    // Step 2: Score via Router-Layer (model selection + AI call)
    const score = await scoreStep({
      doc: scrape.doc,
      tier: input.tier,
      signals: input.signals,
    });

    // Step 3: Persist to Neon Postgres
    const persist = await persistStep({
      url: input.url,
      tier: input.tier,
      scrape,
      score,
    });

    return {
      workflow_status: 'done',
      check_id: persist.check_id,
      result_token: persist.result_token,
    };
  } catch (err) {
    return {
      workflow_status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
