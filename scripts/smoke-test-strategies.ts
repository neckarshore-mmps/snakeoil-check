/**
 * Smoke-test: 1-URL end-to-end pipeline validation — Phase 2 Task 5 prep.
 *
 * This is NOT the §8 #1 benchmark (that needs 5 URLs per
 * `docs/eval-set-phase-2.md`). This is a single-URL validation pass that:
 *   - exercises the full chain fetchHtml → normalize → both strategies
 *   - prints scores AND verbatim evidence quotes side-by-side (per advisor:
 *     for n=1, the QUOTES are the signal, not the numbers)
 *   - validates result shape per pre-defined gates (12 IDs, range, non-empty)
 *   - dumps full JSON to tmp/ for post-hoc inspection
 *   - projects cost vs the plan's €0.30-0.80 estimate for the 5-URL run
 *
 * Usage:
 *   pnpm tsx scripts/smoke-test-strategies.ts <url>
 *
 * Exit codes:
 *   0 = pipeline ran, no validation errors
 *   1 = pipeline ran, validation errors found (see stdout)
 *   2 = bad invocation (missing URL) or fetch/AI threw
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import {
  SCORING_STRATEGIES,
  type StrategyName,
  type StrategyResult,
} from '../src/lib/ai/strategies';
import { CRITERIA, computeWeightedTotal, tendencyFor } from '../src/lib/scoring/criteria';
import { fetchHtml, normalize } from '../src/lib/scraping';

const STRATEGIES: ReadonlyArray<StrategyName> = ['single-call', 'per-criterion'];
const PLAN_BENCHMARK_EUR_LOW = 0.3;
const PLAN_BENCHMARK_EUR_HIGH = 0.8;
const EVAL_SET_SIZE = 5;

// Claude Sonnet 4.5 list prices (USD ≈ EUR for ballpark cost-projection).
const PRICE_INPUT_EUR_PER_M = 3.0;
const PRICE_OUTPUT_EUR_PER_M = 15.0;

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

  // 12 IDs present, no dupes
  const ids = new Set(result.scores.map((s) => s.criterionId));
  if (result.scores.length !== CRITERIA.length) {
    err(`expected ${CRITERIA.length} scores, got ${result.scores.length}`);
  }
  if (ids.size !== result.scores.length) {
    err(`duplicate criterionId in scores`);
  }
  for (const c of CRITERIA) {
    if (!ids.has(c.id)) err(`missing criterionId=${c.id} (${c.name})`);
  }

  // Per-score gates
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

  // Token sanity
  if (result.inputTokens <= 0) err(`inputTokens=${result.inputTokens} (expected >0)`);
  if (result.outputTokens <= 0) err(`outputTokens=${result.outputTokens} (expected >0)`);

  // Latency sanity (warn only)
  if (result.latencyMs <= 0) warn(`latencyMs=${result.latencyMs} (suspicious)`);

  return issues;
}

function pad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return s + ' '.repeat(w - s.length);
}

function lpad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return ' '.repeat(w - s.length) + s;
}

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: pnpm tsx scripts/smoke-test-strategies.ts <url>');
    process.exit(2);
  }

  console.log(`\n=== Smoke-test: 1-URL pipeline validation ===`);
  console.log(`URL: ${url}\n`);

  console.log('1. Fetching + normalizing...');
  const fetchStart = Date.now();
  const { html } = await fetchHtml(url);
  const fetchMs = Date.now() - fetchStart;
  const doc = normalize(html, url);
  console.log(`   fetch: ${html.length} chars HTML in ${fetchMs}ms`);
  console.log(`   normalized: title="${doc.title.slice(0, 80)}"`);
  console.log(`   body: ${doc.bodyText.length} chars`);
  console.log(`   headings: ${doc.headings.length}`);
  console.log(`   testimonials: ${doc.testimonialBlocks.length}`);
  console.log(`   pricing mentions: ${doc.pricingMentions.length}`);

  const results: Partial<
    Record<
      StrategyName,
      StrategyResult & { weightedTotal: number; tendency: string; costEur: number }
    >
  > = {};
  const allIssues: ValidationIssue[] = [];

  for (const strategy of STRATEGIES) {
    console.log(`\n2. Running ${strategy}...`);
    const result = await SCORING_STRATEGIES[strategy](doc);
    const weightedTotal = computeWeightedTotal(result.scores);
    const tendency = tendencyFor(weightedTotal);
    const costEur = eurFor(result.inputTokens, result.outputTokens);
    const issues = validate(strategy, result);
    allIssues.push(...issues);
    results[strategy] = { ...result, weightedTotal, tendency, costEur };
    console.log(
      `   weighted=${weightedTotal.toFixed(1)} | tendency=${tendency} | ` +
        `latency=${result.latencyMs}ms | cost=€${costEur.toFixed(4)} | ` +
        `tokens=${result.inputTokens}in/${result.outputTokens}out`,
    );
    const errs = issues.filter((i) => i.severity === 'error').length;
    const warns = issues.filter((i) => i.severity === 'warn').length;
    console.log(`   validation: ${errs} error(s), ${warns} warning(s)`);
  }

  const single = results['single-call'];
  const perCrit = results['per-criterion'];
  if (!single || !perCrit) {
    console.error('Missing strategy result — should be unreachable.');
    process.exit(2);
  }

  // Side-by-side per-criterion table
  console.log(`\n=== Per-criterion scores (single | per-criterion | diff) ===\n`);
  console.log(
    `${pad('#', 3)} ${pad('Pillar', 10)} ${pad('Criterion', 32)} ${lpad('W', 3)} ${lpad('SC', 4)} ${lpad('PC', 4)} ${lpad('|Δ|', 4)}`,
  );
  console.log('-'.repeat(64));
  const singleMap = new Map(single.scores.map((s) => [s.criterionId, s]));
  const perCritMap = new Map(perCrit.scores.map((s) => [s.criterionId, s]));
  let totalAbsDiff = 0;
  for (const c of CRITERIA) {
    const s = singleMap.get(c.id);
    const p = perCritMap.get(c.id);
    const sc = s?.rawScore ?? -1;
    const pc = p?.rawScore ?? -1;
    const diff = s && p ? Math.abs(s.rawScore - p.rawScore) : -1;
    if (diff >= 0) totalAbsDiff += diff;
    console.log(
      `${lpad(String(c.id), 3)} ${pad(c.pillar, 10)} ${pad(c.name, 32)} ` +
        `${lpad(String(c.weight), 3)} ${lpad(String(sc), 4)} ${lpad(String(pc), 4)} ${lpad(String(diff), 4)}`,
    );
  }
  const avgDiff = totalAbsDiff / CRITERIA.length;
  console.log('-'.repeat(64));
  console.log(
    `Weighted: single=${single.weightedTotal.toFixed(1)} per-crit=${perCrit.weightedTotal.toFixed(1)} ` +
      `(|Δ|=${Math.abs(single.weightedTotal - perCrit.weightedTotal).toFixed(1)}pt)`,
  );
  console.log(
    `Average per-criterion raw-score |Δ|: ${avgDiff.toFixed(2)}pt (Plan-Tolerance ≤ 1.5pt; informational only at n=1)`,
  );

  // Per-criterion evidence side-by-side — the actual signal at n=1
  console.log(`\n=== Per-criterion evidence (read these — quotes hallucinate, scores hide it) ===`);
  for (const c of CRITERIA) {
    const s = singleMap.get(c.id);
    const p = perCritMap.get(c.id);
    console.log(`\n#${c.id} ${c.name} (${c.pillar}, w=${c.weight})`);
    console.log(`  [single-call] score=${s?.rawScore ?? 'n/a'}`);
    console.log(`    quote:     "${(s?.evidenceQuote ?? '').slice(0, 240)}"`);
    console.log(`    rationale: ${(s?.rationale ?? '').slice(0, 240)}`);
    console.log(`  [per-criterion] score=${p?.rawScore ?? 'n/a'}`);
    console.log(`    quote:     "${(p?.evidenceQuote ?? '').slice(0, 240)}"`);
    console.log(`    rationale: ${(p?.rationale ?? '').slice(0, 240)}`);
  }

  // Validation issues
  if (allIssues.length > 0) {
    console.log(`\n=== Validation issues (${allIssues.length}) ===`);
    for (const i of allIssues) {
      console.log(`  [${i.severity.toUpperCase()}] [${i.strategy}] ${i.msg}`);
    }
  } else {
    console.log(`\n=== Validation: PASS (all gates green) ===`);
  }

  // Cost projection vs plan
  const oneUrlTotalEur = single.costEur + perCrit.costEur;
  const fiveUrlProjectedEur = oneUrlTotalEur * EVAL_SET_SIZE;
  console.log(`\n=== Cost projection ===`);
  console.log(`  This run (1 URL × 2 strategies): €${oneUrlTotalEur.toFixed(4)}`);
  console.log(
    `  Projected (${EVAL_SET_SIZE} URLs × 2 strategies): €${fiveUrlProjectedEur.toFixed(4)}`,
  );
  console.log(
    `  Plan estimate: €${PLAN_BENCHMARK_EUR_LOW.toFixed(2)} - €${PLAN_BENCHMARK_EUR_HIGH.toFixed(2)}`,
  );
  if (fiveUrlProjectedEur > PLAN_BENCHMARK_EUR_HIGH) {
    const factor = fiveUrlProjectedEur / PLAN_BENCHMARK_EUR_HIGH;
    console.log(
      `  WARN: projection ${factor.toFixed(1)}× over plan high-bound; surface before approving 5-URL run.`,
    );
  } else if (fiveUrlProjectedEur < PLAN_BENCHMARK_EUR_LOW) {
    console.log(
      `  NOTE: projection under plan low-bound; either smaller pages than assumed or token-count anomaly.`,
    );
  } else {
    console.log(`  OK: projection within plan band.`);
  }

  // JSON dump
  mkdirSync('tmp', { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = `tmp/smoke-test-${timestamp}.json`;
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        url,
        doc: {
          title: doc.title,
          bodyTextLength: doc.bodyText.length,
          headingsCount: doc.headings.length,
          testimonialsCount: doc.testimonialBlocks.length,
          pricingMentionsCount: doc.pricingMentions.length,
        },
        results: {
          'single-call': {
            weightedTotal: single.weightedTotal,
            tendency: single.tendency,
            latencyMs: single.latencyMs,
            inputTokens: single.inputTokens,
            outputTokens: single.outputTokens,
            costEur: single.costEur,
            scores: single.scores,
          },
          'per-criterion': {
            weightedTotal: perCrit.weightedTotal,
            tendency: perCrit.tendency,
            latencyMs: perCrit.latencyMs,
            inputTokens: perCrit.inputTokens,
            outputTokens: perCrit.outputTokens,
            costEur: perCrit.costEur,
            scores: perCrit.scores,
          },
        },
        validation: allIssues,
        costProjectionEur: { oneUrlTotal: oneUrlTotalEur, fiveUrlProjected: fiveUrlProjectedEur },
        runAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`\nJSON dump: ${jsonPath}`);

  const errCount = allIssues.filter((i) => i.severity === 'error').length;
  if (errCount > 0) {
    console.error(
      `\nFAIL: ${errCount} validation error(s). Pipeline ran but produced invalid output.`,
    );
    process.exit(1);
  }
  console.log(`\nOK: pipeline validated end-to-end. NOT a §8 #1 verdict (n=1).`);
}

main().catch((err) => {
  console.error('\nERROR:', err);
  process.exit(2);
});
