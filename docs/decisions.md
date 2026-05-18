# Decisions Log — Snake-Oil-or-Gold Check

Architecture and product decisions, with rationale. Each decision: **Decision → Rationale → Affects**. Numbered D1..Dn.

## D1 — Product Variant: BOTH (LOW first, HIGH later)

**Date:** 2026-05-18
**Decision:** Build LOW-Tier (Free + 3-Shot + 10-Shot) as v0.1 MMP. HIGH-Tier (Single / Vergleichscheck / Retainer) docks onto same backend in v0.3.
**Rationale:** LOW gives technical product surface (TypeScript MMP, scalable infrastructure). HIGH is consulting + templates — needs no separate product. Reusing scoring framework and workflow infrastructure makes HIGH a v0.3 expansion, not a separate build.
**Affects:** Data model designed to support HIGH-tier fields (comparison checks, human-review steps in workflow).

## D2 — v0.1 Scope: Full LOW in one shot (not phased)

**Date:** 2026-05-18
**Decision:** Ship Free + 3-Shot + 10-Shot together in v0.1 (6-8 Wochen), not as separate v0.1a/b/c phases.
**Rationale:** User explicitly preferred single-launch over phased releases despite advisor surfacing speed-vs-scope tension. User accepts longer build time for cleaner public launch.
**Affects:** Build sequence treats all three tiers as part of the same milestone. No intermediate public releases.

## D3 — Repo Location: neckarshore-ai Org

**Date:** 2026-05-18
**Decision:** Code lives at `github.com/neckarshore-ai/snakeoil-check`, not in user's personal GmanFooFoo Org.
**Rationale:** Mini-Geldmaschine = neckarshore.ai portfolio asset. Clean ownership if asset is ever spun off or sold. GmanFooFoo is for person-bound projects (rauhut.com, retro-pong-circuit).
**Affects:** GitHub permissions, deployment ownership, branding latitude (can use neckarshore.ai sub-brand or standalone brand).

## D4 — Tech Stack: Next.js 16 + Vercel + Workflow + AI Gateway

**Date:** 2026-05-18
**Decision:** Next.js 16 App Router on Vercel Fluid Compute. AI via Vercel AI Gateway (`anthropic/claude-sonnet-4.5`). Background work via Vercel Workflow. Neon Postgres + Drizzle. Resend for email. Stripe Checkout Sessions. E-Mail Magic-Link auth (custom).
**Rationale:** Matches neckarshore ecosystem (neckarshore-website, rauhut-website). All-Vercel reduces operational surface to one platform. AI Gateway lets us switch providers without code changes. Workflow gives durable retry for AI calls.
**Affects:** All implementation decisions. Lockfile pinned to exact versions.

## D5 — Architecture: Approach B (Vercel Workflow durable steps)

**Date:** 2026-05-18
**Decision:** AI analysis runs in Vercel Workflow, not directly in API routes.
**Rationale:** Retry-safety for Claude rate-limits, observability per step, durable state if function crashes mid-analysis. *(Note: NOT chosen on AT-1 grounds — advisor correctly pointed out this is route-handler-refactor class, not infrastructure class. Workflow chosen for retry + observability + pattern-learning benefits, not AT-1 mandate.)*
**Affects:** API routes are thin (enqueue + return). Workflow logic in dedicated module. HIGH-tier reuses same Workflow runtime.

## D6 — Scoring as Core Product (dedicated framework doc)

**Date:** 2026-05-18
**Decision:** Scoring framework treated as the product's core differentiator, documented in dedicated `docs/scoring-framework.md` with 12 criteria, weights, rubrics, prompt strategy, calibration plan.
**Rationale:** Advisor correctly identified that scraping + Stripe + email are commodity. The defensibility of the score is what users pay for. Without a defined rubric, the product is a black box.
**Affects:** Calibration is a pre-launch gate. Eval set (15 cases) must be built and AI must pass before paid-shots ship.

## D7 — Auth: E-Mail Magic-Link (no password, no provider)

**Date:** 2026-05-18
**Decision:** Custom magic-link via Server Actions + Resend. No Clerk, Auth0, etc.
**Rationale:** Lean MMP-cut. No social-login needed for our flow. Stripe-purchase already produces email-verified identity. Magic-link tokens stored as SHA-256 hash, 15-min expiry, single-use.
**Affects:** User table is minimal (email + shot-balance). No account self-service in v0.1.

## D8 — Free-Shot Abuse Limits: 1 per 30 days per email-hash

**Date:** 2026-05-18
**Decision:** Free-Shot rate limit = 1 per SHA-256(email-lower) per 30 days. Plus 5 Free-Shots/hour per IP.
**Rationale:** Balance lead-magnet usefulness vs cost. At 0.025 € per Free-Shot, 1000 abusive users/month = 25 € — tolerable. BotID adds bot defense before counting.
**Affects:** Abuse counter table; cron-job to expire email-hash blocks.

## D9 — Cookieless Analytics (Vercel Web Analytics)

**Date:** 2026-05-18
**Decision:** Vercel Web Analytics only. No GA, no Plausible, no Mixpanel. No cookie banner.
**Rationale:** Matches rauhut.com / neckarshore.ai pattern. DSGVO-friendly. Sufficient for v0.1 metrics.
**Affects:** Conversion-funnel analytics must use first-party events through Vercel Analytics custom events. No 3rd-party pixels.

## D10 — Quality-Gate: Human Review for first 50 paid checks

**Date:** 2026-05-18
**Decision:** Workflow includes `await humanApproval()` step on paid checks for the first 50 deliveries. After 50: switch to 10% spot-check sample.
**Rationale:** Calibration confidence — we want to catch bad scores before they reach paying users. Operational pain (need to be ready to approve within ~hours) is bounded.
**Affects:** Workflow design includes pause-point. Mobile-friendly approval UI required.

---

## Decision-Adoption Process

- New decisions: append `D<n+1>` here with Date/Decision/Rationale/Affects.
- Revised decisions: never delete; mark old as `~~superseded~~` and append new D-entry that references the old.
- Decisions touched by external constraints (legal, payment provider terms): document the trigger.

## Decision-Density Reminder

If a single PR touches >2 decisions, slow down. That's an architecture pivot, not a feature. Ping MASCHIN for review before merging.
