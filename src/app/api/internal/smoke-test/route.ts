/**
 * Smoke-test endpoint — Phase 2 Task 5 prep, n=1 pipeline validation.
 *
 * Mirrors `scripts/smoke-test-strategies.ts` but runs in the Vercel runtime
 * (uses the project's `ANTHROPIC_API_KEY` + AI Gateway routing instead of a
 * local key). Returns JSON; consumer (curl + jq) does the formatting.
 *
 * THIS IS NOT THE §8 #1 BENCHMARK. n=1 cannot produce a verdict. This
 * endpoint exists to validate the fetchHtml → normalize → strategies chain
 * end-to-end against ONE real URL and surface evidence quotes so a human
 * can spot hallucination before the 5-URL benchmark is run.
 *
 * Security:
 *   - Gated by `SMOKE_TEST_SECRET` env var (random 32-char token).
 *   - 401 if header `x-smoke-secret` or query `?secret=` does not match.
 *   - Refuses any URL not starting with `https://`.
 *   - NOT deployed in production env intentionally (Preview-only via env var).
 *
 * Cost: ~€0.05-0.15 per call (1 URL × 2 strategies).
 * Latency: ~30-90s.
 */

import { NextResponse } from 'next/server';
import { SCORING_STRATEGIES, type StrategyName, type StrategyResult } from '@/lib/ai/strategies';
import { CRITERIA, computeWeightedTotal, tendencyFor } from '@/lib/scoring/criteria';
import { fetchHtml, normalize } from '@/lib/scraping';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds; 2 strategy calls back-to-back

const STRATEGIES: ReadonlyArray<StrategyName> = ['single-call', 'per-criterion'];
const PRICE_INPUT_EUR_PER_M = 3.0;
const PRICE_OUTPUT_EUR_PER_M = 15.0;
const PLAN_BENCHMARK_EUR_LOW = 0.3;
const PLAN_BENCHMARK_EUR_HIGH = 0.8;
const EVAL_SET_SIZE = 5;

function eurFor(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_EUR_PER_M +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_EUR_PER_M
  );
}

interface ValidationIssue {
  strategy: StrategyName;
  severity: 'error' | 'warn';
  msg: string;
}

function validate(strategy: StrategyName, result: StrategyResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (msg: string) => issues.push({ strategy, severity: 'error', msg });
  const warn = (msg: string) => issues.push({ strategy, severity: 'warn', msg });

  const ids = new Set(result.scores.map((s) => s.criterionId));
  if (result.scores.length !== CRITERIA.length) {
    err(`expected ${CRITERIA.length} scores, got ${result.scores.length}`);
  }
  if (ids.size !== result.scores.length) err('duplicate criterionId in scores');
  for (const c of CRITERIA) {
    if (!ids.has(c.id)) err(`missing criterionId=${c.id} (${c.name})`);
  }
  for (const s of result.scores) {
    if (!Number.isInteger(s.rawScore) || s.rawScore < 0 || s.rawScore > 10) {
      err(`criterion ${s.criterionId}: rawScore ${s.rawScore} out of [0,10]`);
    }
    if (!s.evidenceQuote || s.evidenceQuote.trim().length === 0) {
      err(`criterion ${s.criterionId}: evidenceQuote empty`);
    }
    if (!s.rationale || s.rationale.trim().length === 0) {
      err(`criterion ${s.criterionId}: rationale empty`);
    }
  }
  if (result.inputTokens <= 0) err(`inputTokens=${result.inputTokens} (expected >0)`);
  if (result.outputTokens <= 0) err(`outputTokens=${result.outputTokens} (expected >0)`);
  if (result.latencyMs <= 0) warn(`latencyMs=${result.latencyMs} (suspicious)`);
  return issues;
}

export async function GET(req: Request): Promise<NextResponse> {
  const expected = process.env.SMOKE_TEST_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'SMOKE_TEST_SECRET not configured on this deployment' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const providedSecret = searchParams.get('secret') ?? req.headers.get('x-smoke-secret') ?? '';
  if (providedSecret !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = searchParams.get('url');
  if (!url?.startsWith('https://')) {
    return NextResponse.json({ error: 'missing or non-https ?url=' }, { status: 400 });
  }

  try {
    const fetchStart = Date.now();
    const { html } = await fetchHtml(url);
    const fetchMs = Date.now() - fetchStart;
    const doc = normalize(html, url);

    const results: Record<
      string,
      StrategyResult & { weightedTotal: number; tendency: string; costEur: number }
    > = {};
    const allIssues: ValidationIssue[] = [];

    for (const strategy of STRATEGIES) {
      const result = await SCORING_STRATEGIES[strategy](doc);
      const weightedTotal = computeWeightedTotal(result.scores);
      const tendency = tendencyFor(weightedTotal);
      const costEur = eurFor(result.inputTokens, result.outputTokens);
      allIssues.push(...validate(strategy, result));
      results[strategy] = { ...result, weightedTotal, tendency, costEur };
    }

    const single = results['single-call'];
    const perCrit = results['per-criterion'];
    if (!single || !perCrit) {
      return NextResponse.json(
        { error: 'missing strategy result; should be unreachable', results },
        { status: 500 },
      );
    }
    const oneUrlTotalEur = single.costEur + perCrit.costEur;
    const fiveUrlProjectedEur = oneUrlTotalEur * EVAL_SET_SIZE;

    return NextResponse.json(
      {
        url,
        runAt: new Date().toISOString(),
        doc: {
          title: doc.title,
          fetchMs,
          htmlLength: html.length,
          bodyTextLength: doc.bodyText.length,
          headingsCount: doc.headings.length,
          testimonialsCount: doc.testimonialBlocks.length,
          pricingMentionsCount: doc.pricingMentions.length,
        },
        results,
        validation: allIssues,
        cost: {
          oneUrlTotalEur,
          fiveUrlProjectedEur,
          planEstimateLowEur: PLAN_BENCHMARK_EUR_LOW,
          planEstimateHighEur: PLAN_BENCHMARK_EUR_HIGH,
          inPlanBand:
            fiveUrlProjectedEur >= PLAN_BENCHMARK_EUR_LOW &&
            fiveUrlProjectedEur <= PLAN_BENCHMARK_EUR_HIGH,
        },
        criteriaRef: CRITERIA.map((c) => ({
          id: c.id,
          name: c.name,
          pillar: c.pillar,
          weight: c.weight,
        })),
        verdictDisclaimer:
          'n=1 is a smoke-test, NOT a §8 #1 verdict. Read evidence quotes manually.',
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: 'smoke-test threw',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 8) : undefined,
      },
      { status: 500 },
    );
  }
}
