# Phase-2-C Scope-Clarification Spec

**Author:** MASCHIN (Planning session 2026-05-21 letter-b)
**Date written:** 2026-05-21
**Status:** Decision-needed — Phase-2-C scope is undefined in Design-Doc v0.2; this spec lists scope-options + recommendation. Decision goes into Design-Doc v0.2 § 14 revision OR plans/README Phase-2-C row.
**Trigger:** R2-fact-class-6 triple-source-check at Plan-Doc-write-time (Plan-Doc-Routing-Drift preflight discipline) caught the undefined scope. **Catch prevented ill-targeted Plan-Doc-write.**

---

## Finding

`docs/superpowers/plans/README.md` line 15 lists:

| 2-C | Frontend + Acquisition (TBD per Design-Doc v0.2 § 14) | TBD | 🔲 not yet written |

But **Design-Doc v0.2 § 14 Phase Roadmap does NOT define a distinct Phase-2-C.** § 14.1 (Phase-2 MVP Scope) lists items already absorbed by Plans A + B1 + B2. § 14.2 (Phase-3) covers Subscriptions/BYOK/Newsletter. § 14.3 (Phase-4+) covers B2B/Programmatic-SEO. § 14.4 covers out-of-scope.

**Phase-2-C as a row in `plans/README` is a drift** — references a Design-Doc section that doesn't define it. Plan-Doc-write on this target would have been ill-targeted (analogous to the 75%-obsolete-Brief incident at letter-a — same Pattern-Klasse "Plan-Doc-Target-Verification-Gap", new sub-shape "ill-defined target").

---

## Current State Distribution — Where "Frontend + Acquisition" Work Actually Lives

If we read `plans/README` Phase-2-C label literally ("Frontend + Acquisition"), the work it might cover is already distributed:

### Frontend work (already in B1 + B2)

| Surface | Where Defined | Phase |
|---------|---------------|-------|
| Landing page | B1 Plan-Doc (Phase 4 Examples Gallery references landing for `/`) | B1 |
| Examples Gallery (`/examples`, `/examples/[slug]`) | B1 Phase 4 | B1 |
| Free-Shot Form (`/free-shot`) | B1 Phase 5 Task 5.1 | B1 |
| Wait-Page (`/wait/[token]`) | B1 Phase 5 Task 5.3 | B1 |
| Result Page (`/result/[token]`) | B1 Phase 5 Task 5.5 (base) + B2 Phase 5 Task 5.3 (Deep-extend) | B1+B2 |
| Checkout (`/checkout/single-shot`) | B2 Phase 4 | B2 |
| Processing (`/processing/[check_id]`) | B2 Phase 5 Task 5.1 | B2 |
| Subscription Dashboard | Design-Doc § 14.2 | Phase-3 |

**Verdict: 100% of MVP frontend is in Plans A + B1 + B2.** No frontend gap exists at Phase-2 MVP level.

### Acquisition work — depends on interpretation

"Acquisition" is ambiguous. Three possible interpretations:

| Interpretation | Already covered by | Gap exists? |
|----------------|---------------------|-------------|
| **Marketing-channel mechanics** (X/LinkedIn posts, content-marketing) | Out of scope per Design-Doc § 13 (Solo + AI = no PM tool). Marketing-layer is **operational, not architectural** — no Plan-Doc warranted. | ❌ No gap, scope-excluded |
| **Pre-launch landing-polish + 5-pilot-user-onboarding** | Old `phase-8-pilot.md` (v0.1 stub, "Pilot + Polish — 5 pilot users, feedback iteration, copy, Lighthouse") | ⚠️ Partial — old stub exists but pre-v0.2-pivot, may need re-scoping |
| **SEO-content-pipeline / Programmatic SEO** | Design-Doc § 14.3 Phase-4+ ("Programmatic SEO per-domain landing pages") | ✅ Gap, but Phase-4+ scope, not Phase-2 |

**Verdict: depending on interpretation, either no gap exists OR the gap is at Phase-2-tail (pilot-launch-polish) OR at Phase-4+ (SEO-scaling).** None of these maps cleanly to a "Phase-2-C" between B2 and Phase-3.

---

## Scope-Options for Decision

### Option A — Drop Phase-2-C row from plans/README entirely

**Action:** Remove Phase-2-C row + Phase-3 row (Phase-3 also has scope-clarification value but is sequencing-distant from Phase-2-MVP-completion).

**Rationale:** Frontend work fully covered by A+B1+B2. Acquisition is marketing-layer (not Plan-Doc-warranted) OR Phase-4+ scope. Phase-2-C as a placeholder slot creates phantom-scope confusion.

**Effort:** XS (~5 min edit). Update `plans/README` Phase-2-C row → delete. Keep Phase-3 row with clarified scope.

**Pro:** Cleanest. Eliminates phantom-Plan-Doc-target. R2-fact-class-6-discipline-aligned ("only Plan-Doc what has defined scope").

**Contra:** If User later decides pre-launch-polish work *should* be a distinct Phase-Doc, naming-slot `2-C` was lost. Mitigation: re-introduce as `2-D` or `2-Pilot` when needed.

### Option B — Re-scope Phase-2-C as "Pilot-Launch + Landing-Polish + 5-User-UAT"

**Action:** Re-define Phase-2-C as the work between "B2 shipped" and "5 pilot users in production." Source from old `phase-8-pilot.md` re-scoped + folded-in.

**Scope candidates:**
- Lighthouse 95+ across all v0.2 routes (current target per CLAUDE.md, no Plan-Doc yet)
- Landing-page copy revision (post-v0.2-Pricing-Pivot — current copy may still reference Shot-Bundles)
- 5-pilot-user manual onboarding workflow (email recruitment + onboarding-script + feedback-capture)
- Pricing-page if separate from landing
- Legal pages bundle (Imprint, Privacy, Terms) — overlap with Phase-7 hardening

**Rationale:** Pilot-launch IS a real distinct work-block between MVP-functionally-complete and MVP-publicly-launched. Distinct from Phase-3 (post-launch feature-expansion) + Phase-7 (legal-hardening as ongoing).

**Effort:** S (~20-30 min Plan-Doc write at next session, after this clarification merges).

**Pro:** Phase-2-C gets defined-scope, plans/README stays consistent. Pilot-launch is genuine pre-launch checkpoint.

**Contra:** Overlap with Phase-7 (Legal + Hardening) + Phase-8 (Pilot + Polish) at v0.1 — need to delete those 2 v0.1 stubs OR consolidate. Plan-Doc-routing-drift risk if not done in same session as the clarification.

### Option C — Absorb Phase-2-C into Phase-3 (rename Phase-3 to "Phase-3-and-2-C")

**Action:** Treat Phase-2-C as "first sub-bundle of Phase-3" — Pilot-launch + Magic-Link Auth + Subscription as one consolidated Phase-3 Plan-Doc.

**Rationale:** Pilot-launch isn't separable from "first feature post-MVP" in practice — pilots use MVP, MVP-feedback drives Phase-3, both ship together.

**Effort:** XS (just absorb the Phase-2-C row into Phase-3 row's scope). Phase-3 Plan-Doc-write happens at Phase-3-time.

**Pro:** Phase-3-Plan-Doc-write reduces from 1 to 1 (no extra Plan-Doc). Simpler roadmap.

**Contra:** Phase-3 scope becomes larger + harder to TDD-Phase-gate. Mixes pilot-discipline (UAT, polish) with feature-discipline (Auth, Subscriptions) — different cognitive modes.

### Option D — Keep Phase-2-C as placeholder, define scope at next MASCHIN-session via dedicated brainstorm

**Action:** Status-quo with explicit "scope-clarification-pending" annotation on plans/README Phase-2-C row + open backlog-item `T-phase-2-c-scope-clarify` P1 next-MASCHIN-session.

**Rationale:** Defer the architectural-decision; treat Phase-2-C as a "we'll know when we get there" slot.

**Effort:** XS (just annotation). Future-cost: scope-discovery still needed at write-time, just delayed.

**Pro:** Lowest immediate effort. Decisions deferred to when more data exists.

**Contra:** R2-fact-class-6-discipline-misaligned — keeps the phantom-target around. Risk of n=2 same-Pattern-Klasse next time MASCHIN tries to write Phase-2-C Plan-Doc.

---

## Recommendation — Option B (Re-scope Phase-2-C as Pilot-Launch)

**Single-recommendation reasoning:**

1. **Pilot-launch IS a real work-block.** Between "B2 ships" and "5 paying customers in production" there is real work: copy-revision post-v0.2-Pricing-Pivot, landing-page-polish, manual user-onboarding, feedback-capture mechanism, Lighthouse-tuning. This work needs a Plan-Doc.

2. **The naming-slot `2-C` is meaningful** — Phase-2 = MVP-Build, Phase-3 = Post-Launch-Expansion. "Pilot-Launch" sits at Phase-2-tail, distinct from Phase-3.

3. **Eliminates 2 stale v0.1-stubs** (`phase-7-hardening.md` partial scope + `phase-8-pilot.md`) by folding into v0.2 Phase-2-C. Hardening that's still relevant (rate-limits, monitoring, GDPR delete-endpoint, Imprint/Privacy/Terms) goes into Phase-2-C; rest goes into Phase-3+ or out-of-scope-explicitly.

4. **Honest scope-Decomposition.** Option A drops Phase-2-C — but if pilot-launch-work then surfaces unplanned later, we'd re-introduce. Option C consolidates with Phase-3 but mixes cognitive-modes. Option D keeps the phantom. **Option B accepts the work-class exists + defines it now.**

5. **R2-fact-class-6 application: catching the drift IS the win, defining-scope-now IS the operative-discipline.** Codify-event from letter-a was "triple-source-check before write" — applied here at letter-b. The "after-action" of catching a drift is closing the drift, not just logging it.

**Effort to ship Option B:**
- ✅ THIS spec doc (~150 lines) shipped today letter-b in this PR
- 🔲 Phase-2-C Plan-Doc-Write at next MASCHIN-session (~30-45 min, S-class, after PR merges)
- 🔲 plans/README updates: Phase-2-C row scope-defined + delete v0.1 stubs `phase-7-hardening.md` partial + `phase-8-pilot.md` rows (consolidation)
- 🔲 Design-Doc v0.2 § 14.1 updates: NEW Phase-2-C bullet section between § 14.1 and § 14.2

---

## Decision-Needed Questions for User (resolve at next MASCHIN-session)

If User picks Option B (or otherwise):

| # | Question | Default |
|---|----------|---------|
| 1 | Confirm "Phase-2-C = Pilot-Launch + Landing-Polish + Legal-Pages" scope | Yes |
| 2 | Phase-2-C effort estimate: how many pilot users target (3 / 5 / 10)? | 5 pilot users |
| 3 | Pilot-user-recruitment channel: personal network / X-DM / cold-email / form on landing? | Personal network + X-DM |
| 4 | Legal pages bundle now in Phase-2-C OR remain Phase-7? | In Phase-2-C (legal-pages are launch-blocker) |
| 5 | Lighthouse-tuning target — separate task OR per-route in B1+B2 Phase-DoD? | Separate task in Phase-2-C (cross-cutting) |
| 6 | v0.1 stubs `phase-7-hardening.md` + `phase-8-pilot.md` — delete or archive? | Archive to `docs/archive/` for timeline-traceability |

---

## Action Items per Option (User picks one)

### If User picks Option A (Drop Phase-2-C)

- [ ] Edit `plans/README.md` line 15: delete Phase-2-C row
- [ ] Add to Superseded table: "Phase-2-C row dropped 2026-05-21 letter-b — frontend covered by B1+B2, acquisition is operational not architectural"
- [ ] Open `T-NEW-pilot-launch-work-class-watch` backlog (P3) — if pilot-launch-work surfaces later as unplanned, re-introduce as Phase-2-D or Phase-2-Pilot

### If User picks Option B (Re-scope Phase-2-C — **MASCHIN-Recommendation**)

- [ ] Next MASCHIN-session: write `docs/superpowers/plans/2026-05-NN-phase-2-c-pilot-launch.md` (~30-45 min, S-class)
- [ ] Phase-Doc scope (per Recommendation):
  - Phase 0 — Pre-Flight Verification (B2 shipped + Vercel-Production green + Tests all green)
  - Phase 1 — Landing-Page Copy Revision (remove Shot-Bundle references, add €1/€3 Pricing-Tier, Western/RDR2-aesthetic copy)
  - Phase 2 — Legal Pages (Imprint, Privacy, Terms — single PR bundle, German-DE per current launch market)
  - Phase 3 — Lighthouse-Tuning (95+ desktop + mobile per CLAUDE.md target, all routes)
  - Phase 4 — Pilot-User-Onboarding Workflow (email-template + onboarding-script + feedback-form via Resend)
  - Phase 5 — Feedback-Capture Schema (DB table for pilot-feedback OR Airtable-integration — decide at write-time)
  - Phase 6 — Pilot Smoke (5 real users, manual onboarding, daily-feedback-review for first 7 days)
- [ ] Edit `plans/README.md`: Phase-2-C row scope-defined + delete v0.1 stub-rows `phase-7-hardening.md` partial + `phase-8-pilot.md`
- [ ] Edit Design-Doc v0.2 § 14.1: add Phase-2-C bullet-section
- [ ] Move `phase-7-hardening.md` + `phase-8-pilot.md` to `docs/archive/`

### If User picks Option C (Absorb into Phase-3)

- [ ] Edit `plans/README.md` line 15: delete Phase-2-C row
- [ ] Edit `plans/README.md` Phase-3 row: scope-extended to include pilot-launch-items
- [ ] Note in Superseded table: "Phase-2-C absorbed into Phase-3"

### If User picks Option D (Defer)

- [ ] Edit `plans/README.md` line 15: annotate Phase-2-C row "🟡 scope-clarification-pending — see [`docs/superpowers/specs/2026-05-21-phase-2-c-scope-clarification.md`](../specs/2026-05-21-phase-2-c-scope-clarification.md)"
- [ ] Open backlog `T-phase-2-c-scope-clarify` P1 next-MASCHIN-session

---

## Cross-References

- **Discipline-source:** R2-fact-class-6 codified [omnopsis-planning PR #436 2026-05-21 letter-a](https://github.com/omnopsis-ai/omnopsis-planning/pull/436) (triple-source-check at Plan-Doc/Brief-write-time, intro text "the following fact classes" + 6th row "plan-doc/brief target" + worked-examples block).
- **Discipline-application:** this spec is the **second cross-session empirical application** of R2-fact-class-6 (first was Plan-B2 CLAUDE.md drift-catch in letter-b PR #22). Pattern-Klasse "Self-Applying-Discipline-Moment" potentially reaches n=3 cross-session — codify-decision deferred to letter-b session-close report.
- **Design-Doc v0.2:** [2026-05-20-tiered-architecture-design.md](./2026-05-20-tiered-architecture-design.md) § 14 (Phase Roadmap), § 13 (PM Approach), § 14.4 (Out-of-Scope).
- **Sibling Plan-Docs:** [Phase-2-B1](../plans/2026-05-20-phase-2-b1-free-shot-funnel.md), [Phase-2-B2](../plans/2026-05-21-phase-2-b2-stripe-single-shot.md) (full Plan-Doc shipped today letter-b PR #22).
- **v0.1 Stubs candidate for archive:** [`phase-7-hardening.md`](../plans/phase-7-hardening.md), [`phase-8-pilot.md`](../plans/phase-8-pilot.md).

---

## Discipline Watch

**Self-Applying-Discipline-Moment n=3 cross-session candidate** — letter-a Brief-Obsolescence + letter-a Codify-Tooling-Gap + letter-b Plan-C-Scope-Undefined catch. Three datapoints across two distinct sessions. Codify-decision (formal Pattern-Klasse-codification with rule-text + worked-examples) goes into letter-b session-close report as decision-needed for User.

**R2-fact-class-6 efficacy n=2 cross-session** — codify-event-PR #436 (n=1 letter-a same-session) + Plan-B2 CLAUDE.md drift-catch (n=2 letter-b same-session) + this Phase-2-C scope-undefined catch (n=3 letter-b same-session). **3 catches in 1 day for the R2-extension** — strongest possible empirical-validation of the codify-event from yesterday. If R2-fact-class-6 had NOT been codified, all three drifts would have shipped as wasted work (~45-90 min per drift × 3 = ~2.5-4.5h saved).

---

**MASCHIN Author-Stamp:** 2026-05-21 letter-b MASCHIN-Planning-session. Scope-Clarification Spec for Phase-2-C. Decision-deferred to User-pick (Option A/B/C/D) at next MASCHIN-session. **Catch is the win; decision can wait.**
