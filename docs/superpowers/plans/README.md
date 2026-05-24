# Implementation Plans — Snake-Oil-or-Gold Check

Plans organized by phase. Each phase produces working, testable software on its own. Plans follow `superpowers:writing-plans` skill conventions (bite-sized tasks, exact paths, complete code in steps, TDD where applicable).

> **v0.2 Pricing-Pivot 2026-05-20:** The original v0.1 phase-numbering (Phase 1 → 8) is preserved for historical traceability, but Phases 3 + 4 are SUPERSEDED by the new v0.2 Phase-2 split (A: Foundation, B1: Free-Shot Funnel, B2: Stripe Single-Shot). See [Design-Doc v0.2 § 14](../specs/2026-05-20-tiered-architecture-design.md) for the canonical Phase Roadmap.

## Phase Sequence (current, post-v0.2-pivot)

| # | Plan | File | Status |
|---|------|------|--------|
| 1 | Foundation — scaffold, deploy, DB, tests, CI | `2026-05-18-phase-1-foundation.md` | ✅ MERGED 2026-05-18 |
| 2-A | Foundation — Router-Layer + Multi-Model gateway + DB-schema + Workflow + Benchmarks | `2026-05-20-phase-2-a-foundation.md` | ✅ MERGED 2026-05-20 (PR #16) |
| 2-B1 | **Free-Shot Funnel** — Examples Gallery + Email-Verify-4-Layer + Anti-Abuse + Wait-Page-Conversion-Trick + GDPR Double-Opt-In + Result Page + Resend Audiences | `2026-05-20-phase-2-b1-free-shot-funnel.md` | ✅ written 2026-05-20 letter-e |
| 2-B2 | **Stripe Single-Shot** — Payment-Intent + €1/€3 Checkout + Webhook + Refund-on-Workflow-failure + Stripe Tax + Card-Testing-Rate-Limit | `2026-05-21-phase-2-b2-stripe-single-shot.md` | ✅ written 2026-05-21 letter-b (full Plan-Doc, supersedes 2026-05-20 stub) |
| 2-C | **Pilot-Launch + Landing-Polish + Legal-Pages + Lighthouse-Tuning** — bridge between B2-shipped and 5-pilot-users-in-production. Scope: Lighthouse 95+ across v0.2 routes + Landing-Copy revision post-v0.2-Pricing-Pivot + 5-pilot-user manual onboarding workflow + Legal-Pages bundle (Imprint/Privacy/Terms) + Feedback-Capture mechanism. Absorbs launch-blocker scope from v0.1 `phase-7-hardening.md` + `phase-8-pilot.md` (both archived). | TBD (Plan-Doc next MASCHIN-session) | 🔲 scope-defined 2026-05-24 a per [Spec 2026-05-21 Option B](../specs/2026-05-21-phase-2-c-scope-clarification.md), Plan-Doc not yet written |
| 3 | Subscription Tier + BYOK + Magic-Link Auth + Dashboard + Newsletter Engine | (rename pending — old `phase-5-dashboard.md` + new file) | 🔲 stub |
| 5 | (old "Dashboard + Paid Flows" — superseded by 2-B2 + 3) | `phase-5-dashboard.md` | 🔲 v0.1-stub, scope absorbed into 2-B2 + Phase 3 |
| 6 | Scoring Calibration — eval set, calibration runs, weight adjustments | `phase-6-calibration.md` | 🔲 stub |

## Superseded Plans (preserved for traceability)

| File | Status | Superseded By | Reason |
|------|--------|---------------|--------|
| `phase-2-ai-workflow.md` | ❌ Superseded | `2026-05-20-phase-2-a-foundation.md` | v0.2 Tiered Architecture re-scoped Phase-2 into A/B1/B2 split |
| `phase-3-free-shot.md` | ❌ Superseded 2026-05-20 | `2026-05-20-phase-2-b1-free-shot-funnel.md` | v0.2 Pricing-Pivot: lifetime-limit + Email-Gating + GDPR Double-Opt-In + Wait-Page-Conversion-Trick added |
| `phase-4-stripe-auth.md` | ❌ Superseded 2026-05-20 | `2026-05-21-phase-2-b2-stripe-single-shot.md` (full Plan-Doc 2026-05-21) | v0.2 Pricing-Pivot: Single-Shot €1/€3 Payment-Intent (NOT 3/10-Shot Checkout-Session) + Auth deferred to Phase 3 |
| `2026-05-20-phase-2-b2-stripe-single-shot.md` | ❌ Superseded 2026-05-21 | `2026-05-21-phase-2-b2-stripe-single-shot.md` (full Plan-Doc) | Stub was slot-reservation only (2026-05-20 letter-e); full Plan-Doc written 2026-05-21 letter-b after Stripe-preconditions filled + advisor()-pre-call integrated 11 catches |
| `phase-7-hardening.md` | ❌ Superseded 2026-05-24, archived | Phase-2-C (launch-blocker hardening) + Phase-3+ (ongoing hardening) | v0.2 Pricing-Pivot + Phase-2-C re-scope (Option B): launch-blocker items (Imprint/Privacy/Terms, GDPR delete-endpoint, rate-limits visible in MVP) fold into Phase-2-C Plan-Doc. Non-blocker hardening (monitoring expansion, audit-log polish) re-surfaces at Phase-3 + Phase-4+ Plan-Doc-time. Stub moved to `docs/archive/` for timeline-traceability per [Spec 2026-05-21 Decision-Needed Q6 default](../specs/2026-05-21-phase-2-c-scope-clarification.md). |
| `phase-8-pilot.md` | ❌ Superseded 2026-05-24, archived | `Phase-2-C` (scope-defined 2026-05-24 per Option B) | v0.2 Pricing-Pivot + Phase-2-C re-scope (Option B): pilot-launch + 5-user-UAT + copy-revision + Lighthouse-tuning fold into Phase-2-C. Stub moved to `docs/archive/` for timeline-traceability per [Spec 2026-05-21 Decision-Needed Q6 default](../specs/2026-05-21-phase-2-c-scope-clarification.md). |

## How To Use

1. Read the spec first: **[Design-Doc v0.2 (2026-05-20-tiered-architecture-design.md)](../specs/2026-05-20-tiered-architecture-design.md)** — canonical, supersedes 2026-05-18 MMP Spec (archived to [`docs/archive/`](../../archive/))
2. Pick the phase corresponding to where the build is (currently: Phase-2-B1 next-to-implement)
3. Each plan starts with a header (Goal, Architecture, Tech Stack, Prerequisites), then Phase-gated Tasks with checkbox steps + TDD-discipline (failing-test FIRST commit + RED-gate transcript)
4. Execute via either:
   - `superpowers:subagent-driven-development` — fresh subagent per task with review checkpoints (recommended for production work)
   - `superpowers:executing-plans` — inline batch execution with checkpoints

## When to Write the Next Plan

After a phase plan completes:
1. PR(s) merged to main
2. Vercel preview shows working state matching plan's success criteria
3. MASCHIN runs consistency review (per omnopsis-planning CLAUDE.md rules)
4. **Plan-Doc-Routing-Drift preflight** at top of next Plan-Doc (per 2026-05-20-d + 2026-05-20-e Watch): verify target files exist + are current-version + no superseding-doc
5. Next phase plan gets written from stub, with learnings from prior phase folded in

## Naming Convention

`YYYY-MM-DD-phase-N-<short-name>.md` — date is the date the plan was written (not the target build date). Sub-phase suffixes (`a`, `b1`, `b2`, `c`) for splits within a phase.

## Cross-References

- **Canonical Spec:** [Design-Doc v0.2 (2026-05-20-tiered-architecture-design.md)](../specs/2026-05-20-tiered-architecture-design.md)
- **Archived Spec (v0.1):** [2026-05-18-snakeoil-check-mmp-design.md](../../archive/2026-05-18-snakeoil-check-mmp-design.md) — preserved for timeline reference, do NOT use for implementation
- **Repo-Roadmap:** [`docs/roadmap.md`](../../roadmap.md)
- **Decisions Log:** [`docs/decisions.md`](../../decisions.md)
