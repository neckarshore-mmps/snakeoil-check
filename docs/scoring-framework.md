# Scoring Framework — Snake-Oil-or-Gold Check

**Status:** v0.1 draft — calibration pending against eval set before paid launch.
**Owner:** German Rauhut
**Last updated:** 2026-05-18

The score is the product. Salespage scraping, Stripe checkout, and email delivery are commodity. What differentiates Snake-Oil-or-Gold is that the score is **reproducible**, **defensible**, and **calibrated** — not vibes.

## 1. Score Architecture

```
raw scores (12 criteria, 0-10 each)
  → weighted (criterion weight from table below)
  → summed (0-100 final score)
  → bucketed into tendency:
      75-100  → Go
      45-74   → Vorsicht
      0-44    → Lieber lassen
```

Each criterion produces:
1. **Raw score** (0-10) per the rubric in §3
2. **Evidence quote** — verbatim extract from the source page that justifies the score
3. **Rationale** — 1-2 sentences explaining why this evidence yields this score

The user-facing report shows all 12 criteria as a table: criterion → score → evidence → rationale. **Defensibility:** every number has a quote.

## 2. Criteria Categories

Twelve criteria across four pillars:

| # | Pillar | Criterion | Weight |
|---|--------|-----------|--------|
| 1 | Substance | Specificity of Promises | 8 |
| 2 | Substance | Methodology Transparency | 7 |
| 3 | Substance | Outcome Measurability | 6 |
| 4 | Trust | Provider Track Record | 8 |
| 5 | Trust | Testimonial Authenticity | 7 |
| 6 | Trust | Independent Verifiability | 6 |
| 7 | Pricing | Price-to-Value Transparency | 8 |
| 8 | Pricing | Refund / Cancellation Policy | 5 |
| 9 | Pricing | Pricing-Logic Coherence | 5 |
| 10 | Risk | Urgency / Pressure Tactics | 7 |
| 11 | Risk | Income / Outcome Claims | 9 |
| 12 | Risk | Target-Audience Specificity | 4 |
| | | **Total weight** | **80** |

Weights are an initial guess. **Calibration plan in §6** will re-weight after first 50 real cases.

Final score is rescaled: `(weighted_sum / max_weighted_sum) * 100`.

## 3. Rubric per Criterion

### 3.1 Substance — Specificity of Promises (weight 8)

How concrete and falsifiable are the offer's claimed outcomes?

| Raw | Description | Example wording |
|-----|-------------|-----------------|
| 9-10 | Specific, measurable, bounded outcomes with timeframes | "Du baust in 90 Tagen einen E-Mail-Funnel mit 5 Sequenzen und einer messbaren Open-Rate >25%" |
| 6-8 | Mostly specific but uneven across promises | "Mehr Leads, klare Positionierung, mehr Reichweite — in 12 Wochen" |
| 3-5 | Vague aspirational ("Klarheit", "Sichtbarkeit") with little measurement | "Mehr Selbstvertrauen, neues Mindset, klare Vision" |
| 0-2 | Pure transformation language, no measurable outcome | "Du wirst die Person, die du sein sollst" |

### 3.2 Substance — Methodology Transparency (weight 7)

Does the offer explain HOW it produces the outcome?

| Raw | Description |
|-----|-------------|
| 9-10 | Detailed curriculum, named frameworks, sample lessons / deliverables shown |
| 6-8 | High-level modules outlined, some named methods |
| 3-5 | "Proven proprietary method" without specifics |
| 0-2 | No methodology at all — only outcomes and testimonials |

### 3.3 Substance — Outcome Measurability (weight 6)

Can the user objectively tell whether the outcome was achieved?

| Raw | Description |
|-----|-------------|
| 9-10 | Clear KPIs / deliverables (e.g., "fertiges Funnel-Setup", "5 ausgehende Bewerbungen pro Woche") |
| 6-8 | Mixed: some measurable, some subjective |
| 3-5 | Primarily subjective ("du fühlst dich klarer") |
| 0-2 | No measurable outcomes at all |

### 3.4 Trust — Provider Track Record (weight 8)

How verifiable is the provider's claimed expertise?

| Raw | Description |
|-----|-------------|
| 9-10 | Long public track record: published work, named clients (verifiable), credentials, contact info, named legal entity |
| 6-8 | Some verifiable signals, but partial (e.g., LinkedIn-only, no client list) |
| 3-5 | Only self-claimed credentials; sparse public footprint |
| 0-2 | Anonymous / pseudonymous, no verifiable identity, no Impressum |

### 3.5 Trust — Testimonial Authenticity (weight 7)

Do testimonials look real and verifiable?

| Raw | Description |
|-----|-------------|
| 9-10 | Full-name testimonials with LinkedIn-link, photos, specific outcome details, dates |
| 6-8 | Full names but unverifiable; mostly specific quotes |
| 3-5 | First names only, generic praise, no context |
| 0-2 | Stock photos / no names / contradictions / signs of fabrication |

### 3.6 Trust — Independent Verifiability (weight 6)

Can a third party verify the claims?

| Raw | Description |
|-----|-------------|
| 9-10 | Independent reviews / press coverage / Trustpilot-with-trust-signals / Reddit discussions exist |
| 6-8 | Some independent signals, mixed |
| 3-5 | Only the provider's own materials available |
| 0-2 | Independent search returns nothing OR negative-only signals |

(Note: This criterion's score is filled by the AI from web-search results — Claude Sonnet 4.5 with web-search tool, where available. If web-search unavailable in v0.1, defaults to 5 with note "Independent verification not in v0.1 scope.")

### 3.7 Pricing — Price-to-Value Transparency (weight 8)

Is the pricing visible and proportionate to the disclosed deliverables?

| Raw | Description |
|-----|-------------|
| 9-10 | Price stated upfront, with itemized inclusions (hours, sessions, materials) |
| 6-8 | Price stated, inclusions partial |
| 3-5 | Price hidden behind "Discovery Call" or "Application" only |
| 0-2 | Price not findable anywhere; explicit "ask for price" or scarcity gates |

### 3.8 Pricing — Refund / Cancellation Policy (weight 5)

Is there a clear, fair refund / cancellation policy?

| Raw | Description |
|-----|-------------|
| 9-10 | Clear written refund window (e.g., 14 days), realistic terms |
| 6-8 | Some written policy but with significant conditions |
| 3-5 | "No refunds" stated outright |
| 0-2 | No refund policy mentioned at all |

### 3.9 Pricing — Pricing-Logic Coherence (weight 5)

Does the price make sense relative to comparable offerings?

| Raw | Description |
|-----|-------------|
| 9-10 | Price aligns with similar offerings in the same niche; "fair-market" |
| 6-8 | Slightly high but justifiable by added value |
| 3-5 | 2-5x typical market rate without clear justification |
| 0-2 | 10x+ market rate; pure scarcity-/status-based pricing |

### 3.10 Risk — Urgency / Pressure Tactics (weight 7)

How aggressive are the urgency / scarcity / fear-of-missing-out tactics?

| Raw | Description (higher = LESS pressure = MORE healthy) |
|-----|-------------|
| 9-10 | No countdown, no "last 3 seats", no fake scarcity |
| 6-8 | Some urgency but coherent (e.g., real cohort with real start date) |
| 3-5 | Multiple urgency layers; recurring "limited offer" cycle suspected |
| 0-2 | Heavy: countdown timers, "doors closing", "only 2 spots left", recurring relaunch |

### 3.11 Risk — Income / Outcome Claims (weight 9)

Do they make implausible income / transformation claims?

| Raw | Description (higher = MORE reasonable claims) |
|-----|-------------|
| 9-10 | No income claims OR conservative claims with disclaimers |
| 6-8 | Some income claims with context (median outcomes, not cherry-picked) |
| 3-5 | Heavy showcase of "top 1% success" without typical-outcome context |
| 0-2 | "Replace your full-time income in 6 weeks" without any disclaimers; lottery-pattern claims |

This is weighted highest (9) because it's the strongest snake-oil indicator.

### 3.12 Risk — Target-Audience Specificity (weight 4)

Is the offer clear about WHO it's for and WHO it's NOT for?

| Raw | Description |
|-----|-------------|
| 9-10 | Clear "this is for X with prerequisites Y; NOT for Z" |
| 6-8 | Broad target but with some boundaries |
| 3-5 | "For anyone who wants more" — universal target |
| 0-2 | No target audience defined; explicit "everyone can do this" |

## 4. Prompt Strategy

**Approach: Single multi-criterion call** (not 12 separate calls).

Reasoning:
- Latency: 12 separate calls = 12 × ~5s = 60s; single call = ~10-15s
- Cost: 1 call's input is shared across all 12 criteria → ~70% token savings
- Consistency: single call sees full document context for all criteria

**Trade-off:** longer output → higher hallucination risk on individual criteria. Mitigated via:
1. Structured output via `responseFormat: { type: "json_schema" }` with schema enforcing all 12 criteria + evidence quote requirement
2. Validation step in workflow: reject if any criterion has empty evidence_quote
3. Verification step: spot-check 10% of checks where the evidence quote is searched in source HTML — if not found, flag for human review

**Prompt template** (sketch — exact text in `lib/scoring/prompts.ts`):

```
You are evaluating an online offer for snake-oil indicators. You score 12 criteria
across Substance / Trust / Pricing / Risk.

For EACH criterion you must return:
  - raw_score: 0-10
  - evidence_quote: verbatim from source (max 200 chars)
  - rationale: 1-2 sentences

Use the rubric exactly. Do not invent evidence. If evidence is absent, score
based on the absence (per rubric) and quote "[no statement found]".

Source URL: {url}
Scraped content:
{normalized_text}

Return JSON matching the schema strictly.
```

For Free-Shot: reduced prompt (top-5 criteria only by weight: #1, #4, #7, #10, #11). Cost reduction ~60%.

## 5. Evidence Trace

Every criterion in the report shows the evidence quote and a "Quelle in der Salespage" link (deep-link with text-fragment) where supported.

Format example:

```
Specificity of Promises:  3/10
  Evidence: "Du wirst die beste Version deiner selbst."
  Rationale: Pure transformation language; no measurable outcome or timeframe.
```

## 6. Calibration Plan

### 6.1 Eval Set (must exist before paid-launch)

15 manually labeled cases:

| Bucket | Count | What | Source |
|--------|-------|------|--------|
| Known Gold | 5 | Established providers with clear pricing, methodology, refund policy | e.g., Lenny's Newsletter, RB-Ranking, well-known SaaS courses |
| Known Snake-Oil | 5 | Known dropshipping/get-rich-quick/MLM funnels | Public callouts (Coffeezilla, etc.) |
| Ambiguous | 5 | Real offerings where reasonable people disagree | German coaching market sample |

For each: assign expected score range (e.g., Gold = 75-95, Snake-Oil = 5-30, Ambiguous = 35-65).

### 6.2 Calibration Pass

1. Run all 15 cases through current rubric.
2. Measure: where does the AI's score fall vs expected range?
3. If >2 misses out of 15 → adjust weights, re-run.
4. Repeat until ≤2 misses AND no false-positive in "Known Snake-Oil" (snake-oil scoring >50 is a critical failure).

### 6.3 Production Calibration

After first 50 real paid checks:
1. Sample 10 reports for human review (German Rauhut).
2. For each: would you stand behind the score in court?
3. Pattern-mine: which criterion is most often disagreed-with?
4. Re-weight or revise rubric language for that criterion.
5. Re-run eval set; ensure no regression.

Document each calibration round in `docs/decisions.md` (D-series entries).

## 7. Reproducibility

**Same URL → same score within tolerance (±5 points).**

Achieved via:
1. Deterministic prompt (no randomness in instructions)
2. Model temperature = 0
3. Snapshot of scraped HTML stored per check
4. Re-run capability: any check can be re-scored with same/newer rubric version

Rubric versioning: each `criterion_score` row stores `rubric_version` (semver). When rubric changes, old scores remain valid for their version. New scores use newest version.

## 8. Open Questions

| # | Question | Resolution Plan |
|---|----------|-----------------|
| 1 | Single multi-criterion call vs per-criterion calls | Benchmark both on 5 eval cases. If quality difference <5pt and latency favorable → multi. Decide before v0.1 ship. |
| 2 | Web-search for "Independent Verifiability" criterion | v0.1: skip, default to 5. v0.2: integrate web-search via Claude tool-use if quality benefit clear. |
| 3 | Handling non-DE offers | v0.1: refuse non-DE/EN URLs with clear error. v0.2: support EN. |
| 4 | Score for inaccessible pages (JS-required) | If scrape returns <500 chars of meaningful text → workflow status=failed with explanation, NO score returned. |
| 5 | Adversarial inputs (offer optimized against the rubric) | Year-2 problem. v0.1 documents the risk; v0.2+ adds counter-criteria as we observe gaming attempts. |
