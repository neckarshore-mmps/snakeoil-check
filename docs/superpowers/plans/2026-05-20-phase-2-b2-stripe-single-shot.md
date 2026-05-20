# Phase-2-B2 Stripe Single-Shot Implementation Plan (STUB)

> **STATUS:** Stub — full Plan-Doc to be written in MASCHIN letter-f (or later) after Phase-2-B1 (Free-Shot Funnel) ships and produces conversion-data signal. HARD R4 Orchestration-Class — needs fresh session-context + Stripe-account preconditions verified.

**Goal:** Ship the **paid half** of the Snake-Oil-Check Revenue Path — €1 Standard Single-Shot + €3 Deep Single-Shot via Stripe Payment-Intent (NOT Checkout-Session). Anonymous purchase, no auth required in MVP. First revenue-flow live.

**Sequencing:** Ships AFTER Phase-2-B1 (Free-Shot Funnel) lands. Activation funnel (B1) needs to produce real traffic + conversion-signal before adding the monetization gate. Per advisor() rationale 2026-05-20-e: "you can't measure conversion-rate without funnel-traffic."

## Preconditions (must be verified before Plan-Doc write)

- [ ] Phase-2-B1 Free-Shot Funnel MERGED + LIVE in Production
- [ ] Phase-2-B1 produces 100+ Free-Shots end-to-end (conversion-signal baseline)
- [ ] Stripe Project created on Vercel Marketplace OR direct Stripe Account exists
- [ ] `STRIPE_SECRET_KEY` (test-mode `sk_test_*`) in macOS keychain via AD-33 pattern
- [ ] `STRIPE_SECRET_KEY` (live-mode `sk_live_*`) generated + ready for Production-only Vercel-env
- [ ] `STRIPE_WEBHOOK_SECRET` (test + live separately) in keychain
- [ ] Stripe-CLI installed locally for webhook-forwarding during dev

## Anticipated Scope (per advisor() preview 2026-05-20-e)

**Tasks (TDD-disciplined phase-gated per Pattern-Klasse n=4):**

| Phase | Task-Cluster | Effort |
|-------|--------------|--------|
| 0 | Pre-Flight: Stripe-account + keys + webhook-CLI setup verified | 30 min |
| 1 | Stripe Payment-Intent creation + idempotency-key=check_id + €1/€3 tier-routing | 2-3h |
| 2 | Stripe Webhook handler `payment_intent.succeeded` + signature verification | 2-3h |
| 3 | `/checkout/single-shot` page + Stripe.js Elements (Card + Apple-Pay + Google-Pay) | 3-4h |
| 4 | Frontend: trigger Workflow on payment-success + poll `/api/check/[check_id]/status` | 2h |
| 5 | `/result/[result_token]` extension: €3 Deep-flag rendering + extended-budget Sonnet-call | 2h |
| 6 | Stripe Refund flow (auto-refund on Workflow-failure, manual via Stripe Dashboard for disputes) | 2h |
| 7 | E2E Stripe-CLI test-mode webhook-replays + Playwright happy-path purchase | 3h |

**Total: ~17h of focused Bob-execution.**

## Anticipated Cross-References (when written)

- **Source-of-truth Spec:** Design-Doc v0.2 § 9 (Stripe Integration), § 12.1 (env-vars)
- **Prior Plan (sibling, B1):** [Phase-2-B1 Free-Shot Funnel](./2026-05-20-phase-2-b1-free-shot-funnel.md)
- **Activates B2_LIVE feature-flag** — B1 has Skip-to-€1 CTAs feature-flagged via `B2_LIVE=true|false` env-var. B2 ships → flip flag → CTAs become live.

## Three-Layer Test-Strategy (per advisor() catch D 2026-05-20-e)

1. **Unit:** vi.mock the Stripe SDK + signature-verification with known-good test-payloads
2. **Integration:** Stripe-CLI `stripe listen --forward-to localhost` in dev (documented as setup step)
3. **E2E:** Real Stripe test-mode (`sk_test_*`) hitting Vercel-Preview-deploy webhook via Playwright

**Test-mode → Live-mode env-scope discipline:** explicitly codified in Plan-Doc when written. `sk_test_*` Local + Preview, `sk_live_*` Production-only.

## Out of Scope (defers to later Phases)

- ❌ User accounts / Magic-link auth (→ Phase 3)
- ❌ Subscription (€10/Monat) checkout (→ Phase 3)
- ❌ BYOK (Customer-Keys) flow (→ Phase 3)
- ❌ Self-service refunds (→ Phase 4)
- ❌ B2B Enterprise pricing (→ Phase 4+)

---

**Stub Status:** This file is a Plan-Doc placeholder reserving the file-slot in the naming-convention. Full Plan-Doc will be written when preconditions met + B1 conversion-data available.

**MASCHIN Author-Stamp:** 2026-05-20 letter-e MASCHIN-session. Stub created alongside Phase-2-B1 to clearly establish the B1+B2 split + reserve naming-slot.
