# Phase-2-B2 Stripe Single-Shot Implementation Plan

**Author:** MASCHIN (Planning session 2026-05-21 letter-b)
**Date written:** 2026-05-21
**Supersedes:** [`2026-05-20-phase-2-b2-stripe-single-shot.md`](./2026-05-20-phase-2-b2-stripe-single-shot.md) (stub, slot-reservation only)
**Canonical Spec:** [Design-Doc v0.2 § 9 Stripe Integration](../specs/2026-05-20-tiered-architecture-design.md)
**Sibling Plan:** [Phase-2-B1 Free-Shot Funnel](./2026-05-20-phase-2-b1-free-shot-funnel.md) — execution-time prerequisite (B1 ships first)

> **Goal:** Ship the **paid half** of the Snake-Oil-Check Revenue Path — €1 Standard Single-Shot + €3 Deep Single-Shot via Stripe **Payment-Intent** (NOT Checkout-Session — explicit per Design-Doc § 9). Anonymous purchase, no auth required in MVP. First revenue-flow live.

---

## Pivot-Context (read first)

This Plan-Doc is the **full expansion** of the Phase-2-B2 stub created 2026-05-20 letter-e (PR #20, slot-reservation only). MASCHIN-Planning Tag-62 letter-b (today) writes the full Plan-Doc because:

1. **Stripe-Preconditions filled at session-start** (User-Action 2026-05-21): Stripe-CLI installed via Homebrew (`/opt/homebrew/bin/stripe`), 3 test-mode keys piped to keychain via AD-33 pattern (`stripe_secret_key_test`, `stripe_publishable_key_test`, `stripe_webhook_secret_test`).
2. **B1 Plan-Doc is on main since 2026-05-20T21:26Z** (PR #20 MERGED `2bc3549`) — execution-time prerequisite-doc exists.
3. **HARD R4 advisor()-pre-call** integrated 11 catches (3 critical: CLAUDE.md drift fix in same PR + Write-Time vs Execution-Time precondition layering + Schema already complete = zero new migrations; 8 phase-content: raw-body parse + DB-level idempotency + Refund-own-phase + CSP-coordination + Stripe Tax decision + Card-Testing-Rate-Limit + Apple-Pay/Google-Pay User-Actions + SCA via Elements).
4. **R2-fact-class-6 first empirical application post-codify (2026-05-21 letter-a, PR #436):** triple-source-check at Plan-Doc-write-time caught `CLAUDE.md` line 30 says `Stripe Checkout Sessions + Webhooks` while Design-Doc v0.2 § 9 says `Stripe Payment-Intent (not Checkout-Session)`. **Drift fixed in same PR** — operative discipline, not ceremony.

---

## Architecture Decisions Locked

| # | Decision | Source | Rationale |
|---|----------|--------|-----------|
| 1 | **Stripe Payment-Intent (NOT Checkout-Session)** | Design-Doc § 9 line 644 | Lower fee, embedded UX, control over UI flow, no Stripe-hosted redirect |
| 2 | **Anonymous purchase, no auth** | Design-Doc § 4.3/4.4 | MVP simplicity; account-flow deferred to Phase-3 |
| 3 | **Idempotency-Key = `check_id`** | Design-Doc § 9.2 | Double-click-safe; DB-row created BEFORE PaymentIntent ensures stable key |
| 4 | **DB-level idempotency on `stripe_payment_intent_id`** | advisor() catch #2 | Stripe webhook 5xx-retries are real; signature-verify only proves authenticity, not single-delivery |
| 5 | **Auto-refund on Workflow-failure** | Design-Doc § 9.5 | Scrape-fail OR LLM-retry-exhausted → automatic Stripe refund + email "no charge" |
| 6 | **Stripe Tax integration** | advisor() catch #7 (Option a) | 0.5% fee on €1 = €0.005, negligible vs manual VAT bookkeeping. EU-wide scalable. |
| 7 | **B2_LIVE feature-flag** (env-var gated) | Design-Doc § 4.3, B1 PR #20 | B1 ships with `B2_LIVE=false` (Skip-to-€1 CTAs hidden); flip to `true` after B2 merge |
| 8 | **Card-Testing-Rate-Limit reuses B1 `rate_limits` table** | advisor() catch #8 | Differentiate via `key_type='ip'` + `key_hash = sha256(ip+'|payment_intent_create')`; no schema change |
| 9 | **Zero new Drizzle migrations** | advisor() catch #3 | Phase-2-A `checks` table already has `stripe_payment_intent_id`, `payment_intent_amount_cents`, `payment_status` enum |
| 10 | **No CSP changes in B2 scope** | advisor() catch #6 + verified `next.config.ts` empty headers config | Current snakeoil-check has no restrictive CSP; Stripe.js + iframes load unblocked. Linus Bundle-A L-RH-SEC-HEADERS-PARITY will sequence post-B2 with explicit Stripe-allow rules. |

---

## Prerequisites — Write-Time vs Execution-Time (advisor() critical catch #2)

### Write-Time Preconditions (✅ ALL FILLED at Plan-Doc-write)

Required to write the Plan-Doc with concrete Stripe API references + commands:

- [x] **Stripe-CLI installed** locally — `which stripe` → `/opt/homebrew/bin/stripe`
- [x] **`stripe_secret_key_test`** in macOS keychain (account: `germanrauhut.com`)
- [x] **`stripe_publishable_key_test`** in macOS keychain
- [x] **`stripe_webhook_secret_test`** in macOS keychain (generated via `stripe listen --print-secret`)
- [x] **Stripe-Account active** (User confirmed "Stripe ready" 2026-05-21 letter-b)
- [x] **R2-fact-class-6 triple-source-check applied** — Design-Doc § 9 + CLAUDE.md + Phase-2-A schema verified consistent (CLAUDE.md drift caught + fixed in this PR)

### Execution-Time Preconditions (Phase 0 RE-VERIFY before Bob starts)

Required before Bob starts Phase-2-B2 execution (separate Bob-terminal-session, not now):

- [ ] **Phase-2-B1 PR merged** to snakeoil-check main + LIVE on Vercel Production
- [ ] **Phase-2-B1 Phase-7 Smoke-Tests green** (E2E happy-path + anti-abuse triggers + GDPR UAT + Vercel-Preview UAT)
- [ ] **`B2_LIVE` env-var currently set to `false`** in Vercel Production + Preview (will flip to `true` AFTER B2 merge)
- [ ] **B1 produces ≥100 Free-Shots end-to-end** (conversion-signal baseline) — per advisor() rationale 2026-05-20-e ("you can't measure conversion-rate without funnel-traffic")
- [ ] **Stripe-Account-Live-Mode activated** (User-Action; Test-mode-only sufficient for Phase-2-B2 Phase 1-7 build, Live-keys only needed at Phase-7-deploy-task)
- [ ] **`STRIPE_SECRET_KEY` Production-env = `sk_live_*`** in Vercel (User pipes via AD-33 keychain-pattern at Phase-7-deploy)
- [ ] **`STRIPE_WEBHOOK_SECRET` Production-env = live whsec_*** (Dashboard generates after live-mode webhook endpoint created)

---

## File Structure (decomposition before tasks)

```
src/
├── lib/
│   ├── stripe/
│   │   ├── client.ts                       # Stripe SDK singleton (server-side)
│   │   ├── payment-intent.ts               # createPaymentIntent helper with idempotency
│   │   ├── refund.ts                       # createRefund helper (idempotent)
│   │   └── webhook-verify.ts               # constructEvent + signature verify
│   ├── rate-limit/
│   │   └── payment-intent-create.ts        # 5/min/IP rate-limit (reuses B1 rate_limits table)
│   └── workflow/
│       └── on-failure.ts                   # NEW — Workflow-failure-handler triggers refund
├── app/
│   ├── api/
│   │   ├── checkout/
│   │   │   └── single-shot/route.ts        # POST → create PaymentIntent + Check-row
│   │   └── stripe/
│   │       └── webhook/route.ts            # POST raw-body → verify + idempotent dispatch
│   ├── checkout/
│   │   └── single-shot/page.tsx            # Stripe.js Elements (Card/Apple-Pay/Google-Pay)
│   ├── processing/
│   │   └── [check_id]/page.tsx             # Polling page (5s interval)
│   └── result/
│       └── [result_token]/page.tsx         # EXTEND — €3 Deep-flag richer rendering
└── components/
    └── checkout/
        ├── PaymentForm.tsx                  # Stripe Elements wrapper
        └── DeepAnalysisToggle.tsx           # €1 → €3 upgrade UI

tests/
├── unit/
│   ├── stripe/
│   │   ├── payment-intent.test.ts
│   │   ├── refund.test.ts
│   │   └── webhook-verify.test.ts
│   └── rate-limit/
│       └── payment-intent-create.test.ts
├── integration/
│   └── stripe-webhook-flow.test.ts          # against Stripe-CLI listener
└── e2e/
    ├── happy-path-1euro.spec.ts             # Playwright + Stripe test-card
    ├── happy-path-3euro-deep.spec.ts
    ├── refund-on-workflow-failure.spec.ts
    └── card-testing-rate-limit.spec.ts

public/
└── .well-known/
    └── apple-developer-merchantid-domain-association  # Stripe-generated, User uploads (Phase 8)
```

**~12 new files + 1 extended (`/result/[result_token]/page.tsx`).** Zero new DB migrations.

---

## Phase 0 — Pre-Flight Verification (Gating, ~30 min, NO code)

### Task 0.1 — Verify Stripe-CLI + 3 test-keys in keychain (re-check, may have rotated since Plan-Doc-write)

- [ ] `which stripe && stripe --version` returns a v1.x.x binary
- [ ] `security find-generic-password -a germanrauhut.com -s stripe_secret_key_test &>/dev/null && echo OK` returns OK
- [ ] Same for `stripe_publishable_key_test` and `stripe_webhook_secret_test`
- [ ] If any missing: STOP. User-Action queue — surface to MASCHIN-handoff.

### Task 0.2 — Verify B1 PR merged + B1 Phase-7 Smoke-Tests green

- [ ] `gh pr list --state merged --search "Phase-2-B1" --repo neckarshore-ai/snakeoil-check` returns ≥1 merged PR with B1 in title
- [ ] Inspect B1 PR's CI-rollup: Phase-7 Playwright E2E + GDPR UAT + Vercel-Preview UAT all ✅
- [ ] If B1 not yet merged: STOP. Phase-2-B2 execution gated.

### Task 0.3 — Verify `B2_LIVE` env-var is currently `false`

- [ ] `vercel env ls production | grep B2_LIVE` returns `false` (or env-var not yet set, which is also OK = defaults to false)
- [ ] If `B2_LIVE=true` already: REVERT to `false` before continuing. CTAs in B1 would otherwise dead-link before B2 ships.

### Task 0.4 — Verify CLAUDE.md drift fixed (per R2-fact-class-6, applied in this Plan-Doc's PR)

- [ ] `grep -n "Payment-Intent" CLAUDE.md` returns the Stripe row in the Stack table
- [ ] `grep -n "Checkout Sessions" CLAUDE.md` returns ZERO matches (drift cleaned)
- [ ] If old wording still present: STOP. Plan-Doc's PR didn't ship — verify branch + merge state.

### Task 0.5 — Verify Phase-2-A schema includes Stripe-fields (no new migrations)

- [ ] `grep -nE "stripe_payment_intent_id|payment_intent_amount_cents|payment_status" src/db/schema.ts` returns the three columns on the `checks` table
- [ ] `psql $DATABASE_URL -c "\d checks" | grep -E "stripe_payment_intent_id|payment_intent_amount_cents|payment_status"` confirms columns exist in Production
- [ ] If columns missing: Phase-2-A was incomplete. STOP. Surface to MASCHIN.

### Task 0.6 — Verify B1 `rate_limits` table available (for card-testing rate-limit reuse)

- [ ] `psql $DATABASE_URL -c "\d rate_limits"` confirms table exists with `key_hash`, `key_type`, `count`, `window_start`
- [ ] If table missing: B1 Phase-1 Task 1.3 was incomplete. STOP.

### Task 0.7 — Plan-Doc-Routing-Drift preflight (per Plan-Doc-Routing-Drift R2 discipline)

- [ ] This Plan-Doc references Design-Doc v0.2 § 9 + Phase-2-A schema + Phase-2-B1 prerequisites. Verify all 3 are current canonical (`gh pr view` for B1 + `ls docs/superpowers/specs/2026-05-20-tiered-architecture-design.md` + `ls docs/superpowers/plans/2026-05-21-phase-2-b2-stripe-single-shot.md`)
- [ ] If any reference moved/superseded: STOP. Surface to MASCHIN for Plan-Doc-Routing-Drift correction.

**Phase 0 DoD:** All 7 checks pass. NO code yet. If any check fails, Bob halts + surfaces to MASCHIN-handoff.

---

## Phase 1 — Backend: PaymentIntent API (~2-3h)

**Goal:** `POST /api/checkout/single-shot` accepts `{url, stake, deep, email?}`, creates a `checks` row with `payment_status='pending'`, creates a Stripe PaymentIntent with idempotency-key=`check_id`, returns `{check_id, client_secret}` to frontend.

### Task 1.1 — Failing-test: endpoint schema + Zod validation

- [ ] **RED:** Test asserts POST `/api/checkout/single-shot` with valid body returns 200 + `{check_id, client_secret}`
- [ ] Test: invalid body (missing url) returns 422 with field-level Zod errors
- [ ] Test: invalid URL format returns 422
- [ ] Implementation: Next.js App Router route + Zod schema + handler skeleton
- [ ] **GREEN** + commit `feat(api): POST /api/checkout/single-shot endpoint skeleton + Zod schema`

### Task 1.2 — Card-Testing Rate-Limit (5/min/IP, reuses B1 `rate_limits` table)

- [ ] **RED:** Test asserts 6th request within 60s from same IP returns 429 with `Retry-After: 60` header
- [ ] Test: requests from different IPs are NOT rate-limited together
- [ ] Test: `rate_limits` table row uses `key_hash = sha256(ip_hash + '|payment_intent_create')` (differentiates from B1 free-shot ip-rate-limit)
- [ ] Implementation: `src/lib/rate-limit/payment-intent-create.ts` with composite-key strategy
- [ ] **GREEN** + commit `feat(api): card-testing rate-limit 5/min/IP for PaymentIntent creation`

### Task 1.3 — Stripe SDK singleton + PaymentIntent helper

- [ ] **RED:** Test asserts `createPaymentIntent({check_id, amount_eur, customer_email?})` returns PaymentIntent with `idempotency_key=check_id` and `automatic_tax: {enabled: true}`
- [ ] Test: Same `check_id` called twice returns the SAME PaymentIntent (Stripe-idempotency-replay)
- [ ] Test: `amount_eur=1` produces amount=100 (cents), `amount_eur=3` produces amount=300
- [ ] Test: `automatic_payment_methods.enabled=true` (allows Stripe to auto-include Apple-Pay, Google-Pay)
- [ ] Implementation: `src/lib/stripe/client.ts` (SDK init from `process.env.STRIPE_SECRET_KEY`) + `src/lib/stripe/payment-intent.ts`
- [ ] **GREEN** + commit `feat(stripe): createPaymentIntent with idempotency + automatic tax`

### Task 1.4 — Amount-routing: €1 Standard vs €3 Deep

- [ ] **RED:** Test asserts `deep_analysis_requested=true` OR `stake_indicator='high'` produces €3 PaymentIntent (300 cents)
- [ ] Test: Default (`deep=false`, stake='low'/'medium') produces €1 PaymentIntent (100 cents)
- [ ] Test: Route handler stores `deep_analysis_requested + stake_indicator` on the Check row
- [ ] Implementation: amount-resolver function used by route handler
- [ ] **GREEN** + commit `feat(api): amount-routing €1 standard vs €3 deep based on stake/deep flags`

### Task 1.5 — Check-row creation with `payment_status='pending'`

- [ ] **RED:** Test asserts route creates `checks` row BEFORE PaymentIntent (so `check_id` is stable for idempotency-key)
- [ ] Test: Row has `payment_status='pending'`, `stripe_payment_intent_id=NULL`, `payment_intent_amount_cents=NULL`
- [ ] Test: After PaymentIntent created, row is UPDATED with `stripe_payment_intent_id` + `payment_intent_amount_cents`
- [ ] Test: If Stripe-API throws, Check row's `payment_status` is set to `'failed'` (not orphaned)
- [ ] Implementation: transactional pattern in route handler (DB-row first, then Stripe-call, then UPDATE on success)
- [ ] **GREEN** + commit `feat(api): atomic Check-row + PaymentIntent creation with failure-handling`

**Phase 1 DoD:** Route ships, 5-task TDD-cycle green, Phase-2-A test baseline still green (`pnpm test` → no regressions).

---

## Phase 2 — Backend: Stripe Webhook Handler (~2-3h)

**Goal:** `POST /api/stripe/webhook` receives Stripe events, verifies signature with `STRIPE_WEBHOOK_SECRET`, dispatches on event-type. CRITICAL: raw-body parse + DB-level idempotency.

### Task 2.1 — Failing-test: webhook signature verification

- [ ] **RED:** Test asserts request without `stripe-signature` header returns 400
- [ ] Test: Request with INVALID signature returns 400
- [ ] Test: Request with VALID signature (Stripe SDK constructEvent) returns 200
- [ ] Test: Webhook secret loaded from `process.env.STRIPE_WEBHOOK_SECRET` (mocked in tests)
- [ ] Implementation: `src/lib/stripe/webhook-verify.ts` using `stripe.webhooks.constructEvent`
- [ ] **GREEN** + commit `feat(stripe): webhook signature verification`

### Task 2.2 — Raw-body parsing (Next.js App Router gotcha)

> **Critical:** Stripe signature is computed over the RAW request body. Next.js App Router default JSON-parsing breaks this. MUST read raw body via `await req.text()` BEFORE any JSON parse.

- [ ] **RED:** Test asserts handler reads raw body via `req.text()` (not `req.json()`)
- [ ] Test: Signature verification fails if body was JSON-parsed first (regression-guard)
- [ ] Implementation: route handler uses `const rawBody = await req.text(); const event = stripe.webhooks.constructEvent(rawBody, sig, secret);`
- [ ] Document in route comment: "DO NOT call req.json() — signature is over raw bytes"
- [ ] **GREEN** + commit `feat(stripe): raw-body parse for webhook (App Router signature-verify discipline)`

### Task 2.3 — DB-level idempotency on `stripe_payment_intent_id`

> **Critical:** Stripe retries webhook delivery on 5xx (default 3 attempts over hours). Signature-verify proves authenticity but does NOT prevent duplicate execution. DB-level idempotency required.

- [ ] **RED:** Test asserts handler processes same `payment_intent.succeeded` event TWICE without double-side-effects (no double-Workflow-trigger, no double-DB-update)
- [ ] Test: Uses `UPDATE checks SET payment_status='paid' WHERE stripe_payment_intent_id=$1 AND payment_status='pending' RETURNING *` — only flips if row was actually pending; second call returns 0 rows = no-op
- [ ] Test: Workflow.start() only triggered when DB-UPDATE returned a row (first delivery)
- [ ] Implementation: conditional-UPDATE pattern in handler
- [ ] **GREEN** + commit `feat(stripe): DB-level idempotency on stripe_payment_intent_id`

### Task 2.4 — `payment_intent.succeeded` → flip status + trigger Workflow

- [ ] **RED:** Test asserts on `payment_intent.succeeded`: DB row flips `payment_status='pending'` → `'paid'`, Workflow.start(check_id) called once
- [ ] Test: If Workflow.start throws, payment_status remains `'paid'` (don't revert — Workflow will be retried via its own resilience or via Phase 3 refund-on-failure)
- [ ] Implementation: event-dispatch switch in route handler
- [ ] **GREEN** + commit `feat(stripe): payment_intent.succeeded → payment_status=paid + Workflow.start`

### Task 2.5 — `payment_intent.payment_failed` → flip status, NO Workflow

- [ ] **RED:** Test asserts on `payment_intent.payment_failed`: DB row flips `payment_status='pending'` → `'failed'`, Workflow NOT triggered
- [ ] Test: Optional — log failure-reason from Stripe-event into a debug-field (not user-facing, just for ops)
- [ ] Implementation: same event-dispatch switch
- [ ] **GREEN** + commit `feat(stripe): payment_intent.payment_failed → payment_status=failed (no Workflow)`

### Task 2.6 — Stripe-CLI integration smoke (manual + scripted)

- [ ] Document in `docs/dev/stripe-webhook-local.md` (NEW): `stripe listen --forward-to localhost:3000/api/stripe/webhook` + `stripe trigger payment_intent.succeeded`
- [ ] Add `pnpm script` alias: `"webhook:listen": "stripe listen --forward-to localhost:3000/api/stripe/webhook"`
- [ ] Manual smoke: User runs both terminals in parallel + triggers test-event + observes DB-flip
- [ ] No commit needed for docs-only addition until Phase 2 DoD commit

**Phase 2 DoD:** Webhook ships, 5-task TDD-cycle green, Stripe-CLI smoke documented, Phase-2-A + Phase 1 tests still green.

---

## Phase 3 — Backend: Refund-on-Workflow-Failure (~2-3h)

**Goal:** When Workflow fails (scrape unreachable, LLM-retry-exhausted, scoring-error), automatically refund the customer via Stripe Refund API + email "no charge" notification. Atomic DB-flip.

### Task 3.1 — Failing-test: Workflow-failure-event detection

- [ ] **RED:** Test asserts when Workflow reaches `workflow_status='failed'`, refund-handler fires
- [ ] Test: Refund-handler does NOT fire for `workflow_status='done'` or `'running'`
- [ ] Test: Refund-handler does NOT fire if `payment_status != 'paid'` (no charge to refund)
- [ ] Implementation: `src/lib/workflow/on-failure.ts` triggered by Workflow's failure-callback OR by polling job (decide based on Vercel Workflow docs — prefer callback)
- [ ] **GREEN** + commit `feat(workflow): on-failure handler detection`

### Task 3.2 — Stripe Refund creation with idempotency-key = `refund_<check_id>`

> **Critical:** Refund idempotency-key MUST differ from PaymentIntent-creation-key. Use `refund_<check_id>` to allow same Check to be refunded exactly once.

- [ ] **RED:** Test asserts `createRefund({check_id, payment_intent_id})` uses idempotency-key=`refund_<check_id>`
- [ ] Test: Calling twice with same `check_id` returns the SAME Refund (Stripe-idempotency-replay)
- [ ] Test: `reason='requested_by_customer'` (Stripe-enum-value, since this is system-issued-for-customer-benefit, not fraud)
- [ ] Implementation: `src/lib/stripe/refund.ts`
- [ ] **GREEN** + commit `feat(stripe): createRefund with idempotency-key refund_<check_id>`

### Task 3.3 — Atomic DB-flip `payment_status='refunded'` with Stripe-API call

- [ ] **RED:** Test asserts on successful Stripe-Refund-API call: DB row flips `payment_status='paid'` → `'refunded'`
- [ ] Test: If Stripe-Refund-API throws: DB row STAYS `'paid'` (no false-flip), retry-queue entry written
- [ ] Test: Conditional-UPDATE pattern again — `UPDATE checks SET payment_status='refunded' WHERE id=$1 AND payment_status='paid'` (only flips paid rows)
- [ ] Implementation: try/catch around Stripe-call with DB-flip in success branch
- [ ] **GREEN** + commit `feat(workflow): atomic DB-flip + Stripe-refund on workflow failure`

### Task 3.4 — Resend "Refund issued" email (if email captured at checkout)

- [ ] **RED:** Test asserts if `customer_email` was provided at checkout: Resend.send called with refund-template
- [ ] Test: If no `customer_email`: skip silently (no log-error)
- [ ] Test: Email template includes refund-amount + reason (URL unreachable / analysis failed) + Stripe-receipt-link
- [ ] Implementation: Resend integration in `src/lib/workflow/on-failure.ts` using existing Resend client from B1
- [ ] **GREEN** + commit `feat(workflow): Resend refund-notification email on auto-refund`

### Task 3.5 — Edge case: Stripe-Refund-API down → retry queue (not silent fail)

- [ ] **RED:** Test asserts when Stripe-API throws with retryable error (5xx, network): retry-queue row written
- [ ] Test: Retry-queue uses an own simple table OR Vercel-Workflow-step pattern (decide based on Vercel Workflow docs — prefer Workflow-step-retry-native)
- [ ] Test: Customer-email NOT sent until refund actually succeeds (don't promise refund prematurely)
- [ ] Document fallback: if retry-queue grows >threshold → ops alert (Sentry / log-watch — Phase-7 hardening scope, NOT B2)
- [ ] Implementation: retry-mechanism using Vercel Workflow's native retry or simple cron-driven retry-table
- [ ] **GREEN** + commit `feat(workflow): refund retry-queue for Stripe-API-down scenarios`

**Phase 3 DoD:** Refund-handler ships, 5-task TDD-cycle green, Phase 1+2 tests still green.

---

## Phase 4 — Frontend: Checkout Page (~3-4h)

**Goal:** `/checkout/single-shot` page mounts Stripe Elements (Card + Apple-Pay + Google-Pay), retrieves `client_secret` from API, handles SCA (Strong Customer Authentication) via Stripe-managed flow.

### Task 4.1 — Failing-test: Page route + initial render

- [ ] **RED:** Playwright test asserts `/checkout/single-shot?url=<x>&deep=true` renders form with URL pre-filled + €3 amount shown
- [ ] Test: Page calls `POST /api/checkout/single-shot` on mount to retrieve `client_secret`
- [ ] Test: Page handles error from API (rate-limit 429, validation 422) with user-facing messages
- [ ] Implementation: Next.js App Router page with client-component for Stripe-Elements (`'use client'`)
- [ ] **GREEN** + commit `feat(checkout): /checkout/single-shot page route with API integration`

### Task 4.2 — Stripe Elements + Payment-Element setup

- [ ] **RED:** Test asserts Stripe-Elements mounts after `client_secret` retrieved
- [ ] Test: Uses `PaymentElement` (Stripe's unified Element — auto-includes Card, Apple-Pay, Google-Pay based on browser/device)
- [ ] Test: `appearance` prop matches snakeoil-check brand tokens (dry/skeptical Western/RDR2 aesthetic per CLAUDE.md)
- [ ] Implementation: `src/components/checkout/PaymentForm.tsx` wrapping `<Elements>` + `<PaymentElement>` from `@stripe/react-stripe-js`
- [ ] Dependencies: `@stripe/stripe-js@<exact>` + `@stripe/react-stripe-js@<exact>` (use `--save-exact` per CLAUDE.md)
- [ ] **GREEN** + commit `feat(checkout): Stripe Payment-Element with brand-matched appearance`

### Task 4.3 — Submit → `stripe.confirmPayment` + redirect to processing page

- [ ] **RED:** Test asserts on form-submit: `stripe.confirmPayment({elements, confirmParams: {return_url: '/processing/[check_id]'}})` called
- [ ] Test: On success-redirect: browser navigates to `/processing/[check_id]`
- [ ] Test: On failure (declined card, network): user-facing error shown, form re-submittable
- [ ] Implementation: form-submit handler with Stripe-confirmPayment-call
- [ ] **GREEN** + commit `feat(checkout): submit handler with confirmPayment + redirect`

### Task 4.4 — SCA (3DS) handled via Stripe Elements

> **No custom code needed.** Stripe-Elements handles 3DS-challenges transparently — if customer's card requires 3DS, Stripe shows the challenge UI in-Element. Document this in the route's comments.

- [ ] Add comment in route: "SCA/3DS challenges handled automatically by Stripe-Elements. Test with Stripe test-card 4000002500003155 (3DS-required) in Phase 7 E2E."
- [ ] No additional task — included in Phase 4 DoD verification

### Task 4.5 — Deep-Analysis-Toggle component (€1 → €3 upgrade UI)

- [ ] **RED:** Playwright test asserts toggle changes amount from €1 to €3 + re-calls API to update PaymentIntent (or — decision: client-side amount-recalc only, API-call only on submit)
- [ ] Decision: Re-call API on toggle to ensure idempotency-key stays consistent. Cost: 1 extra API-call per toggle-flip. Benefit: clean state.
- [ ] Test: Toggle pre-selects ON if `?deep=true` URL param OR stake='high'
- [ ] Implementation: `src/components/checkout/DeepAnalysisToggle.tsx` + integration into checkout page
- [ ] **GREEN** + commit `feat(checkout): DeepAnalysisToggle with amount-recalc`

**Phase 4 DoD:** Checkout page ships, 4-task TDD-cycle green + manual smoke on local dev (Stripe-test-card 4242 4242 4242 4242).

---

## Phase 5 — Frontend: Processing Page + Result-Page Extension (~2h)

**Goal:** `/processing/[check_id]` polls `/api/check/[check_id]/status` every 5s, redirects to `/result/[result_token]` when Workflow done. Result-page extended with €3 Deep-flag richer rendering.

### Task 5.1 — Failing-test: Processing page with polling

- [ ] **RED:** Test asserts page polls `/api/check/[check_id]/status` every 5s
- [ ] Test: On `workflow_status='done'` response: redirect to `/result/<result_token>`
- [ ] Test: On `workflow_status='failed'`: show refund-message + Stripe-receipt-link
- [ ] Test: On `payment_status='refunded'`: show "Refund issued" with reason
- [ ] Test: Loading-state with progress-indication (3-5 step animation per B1 Wait-Page-Conversion-Trick reference — decide: re-use B1 component? Or simple spinner? Pick re-use for consistency)
- [ ] Implementation: `/processing/[check_id]/page.tsx` using `useEffect` polling
- [ ] **GREEN** + commit `feat(processing): polling page with redirect/refund-handling`

### Task 5.2 — `/api/check/[check_id]/status` endpoint

> **Likely exists from Phase-2-A or B1.** If not: this task creates it. Otherwise: verify response shape includes `workflow_status` + `payment_status` + `result_token` + `refund_reason?`

- [ ] **RED:** Test asserts endpoint returns shape `{workflow_status, payment_status, result_token, refund_reason?}`
- [ ] Test: 404 if check_id doesn't exist (don't leak existence to attackers)
- [ ] Test: Public endpoint (no auth) but rate-limited to prevent enumeration (~10/min/IP)
- [ ] Implementation: extend or create the endpoint
- [ ] **GREEN** + commit `feat(api): /api/check/[check_id]/status with shape for processing-page`

### Task 5.3 — Result-Page Deep-flag richer rendering

- [ ] **RED:** Playwright test asserts `/result/[result_token]` with `deep_analysis_requested=true` shows extended evidence-quotes per criterion (longer than €1 standard)
- [ ] Test: Page shows "Deep Analysis" badge for €3 results
- [ ] Test: Page shows payment-receipt-link (Stripe-receipt-URL stored on Check row or generated on-demand from PaymentIntent)
- [ ] Implementation: `app/result/[result_token]/page.tsx` EXTEND (existing from B1) with conditional Deep-rendering
- [ ] **GREEN** + commit `feat(result): deep-flag richer rendering + payment-receipt link`

**Phase 5 DoD:** 3-task TDD-cycle green, polling-page + result-extension ship, Phase 1-4 tests still green.

---

## Phase 6 — Tax + Receipt Configuration (~1h)

**Goal:** Stripe Tax automatic VAT calculation enabled. PaymentIntent created with `automatic_tax: {enabled: true}` (already in Phase 1 Task 1.3). Receipt-emails Stripe-managed.

### Task 6.1 — Stripe Tax enabled in Dashboard (User-Action)

- [ ] User opens Stripe Dashboard → Settings → Tax
- [ ] Enable Tax for Germany (DE) + EU-wide (Germany default jurisdiction since business is German-based)
- [ ] Configure tax-category: "General services" or "Digital services" (digital services = correct for AI-analysis output)
- [ ] Verify Test-mode tax-calc works: `stripe trigger payment_intent.succeeded` and inspect amount-breakdown in Dashboard
- [ ] Document in `docs/dev/stripe-tax-setup.md` (NEW)

### Task 6.2 — `automatic_tax: {enabled: true}` in PaymentIntent (already in Phase 1 Task 1.3)

- [ ] Verify Phase 1 Task 1.3 implementation has `automatic_tax: {enabled: true}` flag set
- [ ] If not: amend Phase 1 implementation (regression-guard test in Task 6.2)
- [ ] **RED:** Test asserts PaymentIntent has `automatic_tax.enabled=true`
- [ ] **GREEN** + commit `test(stripe): regression-guard automatic_tax enabled on PaymentIntent`

### Task 6.3 — Receipt-email handling (Stripe-managed)

- [ ] **RED:** Test asserts if `customer_email` provided at PaymentIntent-creation: `receipt_email=<email>` set on PaymentIntent
- [ ] Test: Stripe will automatically send receipt-email on payment-success (test-mode also sends, verify in Test-mode email-log)
- [ ] If no email: receipt-link still available via PaymentIntent.charges[0].receipt_url (server-side fetch for /result-page-display)
- [ ] **GREEN** + commit `feat(stripe): receipt-email handling + receipt-url for anonymous customers`

### Task 6.4 — Document VAT line in receipt + GDPR impact

- [ ] Document in `docs/dev/stripe-tax-setup.md`: VAT-line shown on Stripe-receipt automatically. Customer sees gross-amount with VAT-breakdown.
- [ ] Document GDPR: customer_email used for receipt = legitimate-interest (Art 6(1)(b) — contract fulfillment), separate from marketing consent (Resend Audiences in B1)
- [ ] No code task — documentation only

**Phase 6 DoD:** Stripe Tax live in Test-mode, receipt-handling tested, docs updated, Phase 1-5 tests still green.

---

## Phase 7 — E2E Tests + Smoke (~3h)

**Goal:** Playwright E2E tests cover the full purchase flow with Stripe test-cards. Stripe-CLI webhook-replay smoke. Card-testing rate-limit smoke. Refund-on-failure smoke.

### Task 7.1 — Playwright happy-path: €1 Standard purchase end-to-end

- [ ] **RED:** Test asserts full flow: Landing → free-shot result → upgrade-CTA → checkout → Stripe-test-card 4242 → processing-page → result-page (full 12 criteria)
- [ ] Test: Uses Stripe test-card `4242 4242 4242 4242` (succeeds immediately, no 3DS)
- [ ] Test: Verifies DB-state at each step (Check row created → payment_status=paid → workflow_status=done)
- [ ] Implementation: `tests/e2e/happy-path-1euro.spec.ts`
- [ ] **GREEN** + commit `test(e2e): happy-path €1 purchase end-to-end`

### Task 7.2 — Playwright happy-path: €3 Deep purchase

- [ ] **RED:** Test asserts toggle to Deep + €3 amount + result-page shows Deep-flag rendering
- [ ] Test: Uses Stripe test-card `4242 4242 4242 4242`
- [ ] Implementation: `tests/e2e/happy-path-3euro-deep.spec.ts`
- [ ] **GREEN** + commit `test(e2e): happy-path €3 deep purchase`

### Task 7.3 — 3DS / SCA flow with test-card

- [ ] **RED:** Test asserts Stripe-test-card `4000 0025 0000 3155` (3DS-required) triggers 3DS-challenge UI
- [ ] Test: Completing 3DS-challenge → payment succeeds → workflow triggers → result shown
- [ ] Implementation: extend happy-path test OR new `tests/e2e/sca-3ds-flow.spec.ts`
- [ ] **GREEN** + commit `test(e2e): SCA 3DS challenge flow with test-card`

### Task 7.4 — Stripe-CLI webhook-replay smoke

- [ ] Document smoke-script in `docs/dev/stripe-webhook-local.md`: `stripe trigger payment_intent.succeeded` + observe DB-state
- [ ] Document: `stripe trigger payment_intent.payment_failed` + verify status=failed, no Workflow
- [ ] Optional: scripted via `pnpm script` aliases for CI-future
- [ ] Manual-execution by Bob, no commit needed beyond docs

### Task 7.5 — Card-testing rate-limit smoke (Playwright)

- [ ] **RED:** Test asserts 6th request from same simulated-IP within 60s returns 429
- [ ] Test: Different IPs not rate-limited together
- [ ] Implementation: `tests/e2e/card-testing-rate-limit.spec.ts` using Playwright + setExtraHTTPHeaders for X-Forwarded-For simulation
- [ ] **GREEN** + commit `test(e2e): card-testing rate-limit smoke`

### Task 7.6 — Refund-on-Workflow-failure smoke

- [ ] **RED:** Test asserts forcing Workflow-failure (mock LLM-down OR scrape-fail) triggers refund + email + DB-flip to `refunded`
- [ ] Test: Customer-email-flow (if email provided): refund-email sent via Resend
- [ ] Implementation: `tests/e2e/refund-on-workflow-failure.spec.ts` with mocked LLM-failure
- [ ] **GREEN** + commit `test(e2e): refund-on-workflow-failure end-to-end`

**Phase 7 DoD:** 6-task E2E suite green, all Phase 1-6 unit/integration tests still green, manual Stripe-CLI smoke documented.

---

## Phase 8 — Apple-Pay / Google-Pay Domain Verification (CONDITIONAL, ~XS User-Actions)

> **Optional for MVP-launch.** Card-payments work without Apple-Pay/Google-Pay. Domain-verification adds these payment-methods to the PaymentElement automatically. Total ~10-15 min User-Action.

### Task 8.1 — Apple-Pay domain verification (User-Action)

- [ ] User: Stripe Dashboard → Settings → Payment methods → Apple Pay → "Add domain" → input `snakeoilcheck.com` (or actual domain)
- [ ] Stripe generates `.well-known/apple-developer-merchantid-domain-association` file content
- [ ] User downloads file → places in `public/.well-known/apple-developer-merchantid-domain-association`
- [ ] Commit `feat(checkout): Apple-Pay domain-association file for Stripe verification`
- [ ] User: Stripe Dashboard → verify domain → status flips to "Verified"

### Task 8.2 — Google-Pay merchant verify (User-Action)

- [ ] User: Stripe Dashboard → Settings → Payment methods → Google Pay → Configure
- [ ] Add merchant-name + domain in Dashboard
- [ ] No file needed (Google-Pay uses Stripe's merchant-account directly)

### Task 8.3 — Smoke-test on Vercel-Preview

- [ ] Open Vercel-Preview URL on iOS Safari (Apple-Pay device) — verify Apple-Pay button appears in PaymentElement
- [ ] Open on Chrome Android (Google-Pay device) — verify Google-Pay button appears
- [ ] Run test-payment with Apple-Pay/Google-Pay test-card
- [ ] If buttons don't appear: domain not verified or browser doesn't support — fall back to Card-only is acceptable for MVP

**Phase 8 DoD:** User-Actions documented, files in place, domain verified in Dashboard, smoke-test on real devices. CONDITIONAL — skip if MVP launches Card-only.

---

## Success Criteria (Phase-2-B2 Done When)

- [ ] All 8 Phases shipped (Phase 8 optional)
- [ ] All E2E tests green in CI (Phase 7 suite)
- [ ] All Phase 1-2-A + B1 + B2 unit/integration tests still green (no regressions)
- [ ] Stripe Test-mode flow works end-to-end on Vercel-Preview (`stripe_secret_key_test` + Preview env)
- [ ] Stripe Live-mode keys piped to Vercel Production (User-Action at Phase-7-deploy-task)
- [ ] Live-mode smoke: 1 real €1 purchase by User from external device, verifying full flow + receipt-email + refund-on-induced-failure works
- [ ] `B2_LIVE` env-var flipped from `false` → `true` in Production after live-smoke
- [ ] B1 Skip-to-€1 CTAs now live-link to B2 checkout
- [ ] Stripe Tax calculating VAT correctly for Germany
- [ ] Card-testing rate-limit holding (5/min/IP)
- [ ] Refund-on-failure auto-issues refund + email within 60s of Workflow-failure
- [ ] Manual UAT by User: 3 distinct test-purchases (€1 standard, €3 deep, 3DS-required) all flow clean
- [ ] PIR (post-implementation review) by MASCHIN: matches Plan-Doc scope, no significant deviations

---

## Risks + Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Stripe webhook delivery delays during high-traffic → user sees stuck `/processing` page | Medium | Medium | Processing-page also has timeout (e.g., 3 min) → show "Still processing, check back later via /result/[token]" + send email when done |
| 2 | Card-testing-attacker rate-limit too restrictive blocks real customers | Low | High | 5/min/IP is permissive for normal usage (real customers retry at most 2-3x). If false-positives surface: bump to 10/min/IP, surface to MASCHIN |
| 3 | Stripe Tax automatic calc fails for unusual VAT jurisdictions (non-EU) | Medium | Low | Phase-2 launches DE-only marketing → Tax-config only needs to cover DE/EU. Document as known-limitation. |
| 4 | Refund-on-failure infinite-loop (refund fails → retry → fails → ...) | Low | High | Phase 3 Task 3.5 retry-queue with max-retry-count; if exhausted: log to Sentry (Phase-7-hardening scope) + manual ops-intervention |
| 5 | Stripe-API key leak (test or live) into git history | Low | Critical | Keys ONLY in keychain via AD-33 pattern. `.env*` in `.gitignore`. CI secret-scanning. Per 2026-05-18-e env-dump-leak precedent: NEVER paste keys in agent-transcripts. |
| 6 | DB-level idempotency race-condition under concurrent webhook delivery | Low | Medium | Postgres `UPDATE ... WHERE payment_status='pending'` is atomic at row-level → conditional-update wins. Test under simulated race in Phase 2 Task 2.3. |
| 7 | Stripe Elements iframe blocked by future CSP rollout (Linus Bundle-A) | Medium | Medium | Coordinate sequencing: B2 ships first WITHOUT CSP, then Linus CSP-per-site adds `frame-src https://js.stripe.com https://hooks.stripe.com` explicitly. Document Linus Bundle-A dependency. |
| 8 | Apple-Pay/Google-Pay button-absence on supported browsers (user reports "I don't see Apple-Pay") | Medium | Low | Phase 8 is conditional/optional for MVP. Document fallback: Card-only is acceptable launch state; Apple-Pay/Google-Pay can be added post-launch. |

---

## Cross-References

- **Source-of-truth Spec:** [Design-Doc v0.2 (2026-05-20-tiered-architecture-design.md)](../specs/2026-05-20-tiered-architecture-design.md)
  - § 4.3 Tier 1 €1 Standard Single-Shot
  - § 4.4 Tier 1.5 €3 Deep Single-Shot
  - § 5.1 Data Model (`checks` table with Stripe-fields)
  - § 9 Stripe Integration (Payment-Intent flow, idempotency, webhook, refunds)
  - § 12.1 Env-Variable Matrix (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- **Prior Phase Plans:**
  - [Phase-1 Foundation](./2026-05-18-phase-1-foundation.md) — DB, deploy, CI baseline
  - [Phase-2-A Foundation](./2026-05-20-phase-2-a-foundation.md) — Router, Gateway, Workflow, schema with Stripe-fields
  - [Phase-2-B1 Free-Shot Funnel](./2026-05-20-phase-2-b1-free-shot-funnel.md) — Sibling Plan, execution-time prerequisite, `rate_limits` table reuse, Skip-to-€1 CTAs feature-flagged on `B2_LIVE`
- **Repo-Level:**
  - [`CLAUDE.md`](../../../CLAUDE.md) — fixed in same PR (line 30 `Stripe Payment-Intent + Webhooks`)
  - [`docs/superpowers/plans/README.md`](./README.md) — status flipped from 🔲 stub → ⏳ ready-to-implement
- **Planning-Repo:**
  - [omnopsis-planning maschin.yaml](https://github.com/omnopsis-ai/omnopsis-planning/blob/main/docs/process/sessions/maschin.yaml) — tracks Plan-Doc-write event
  - [omnopsis-planning handoff-protocol R2 fact-class 6](https://github.com/omnopsis-ai/omnopsis-planning/blob/main/docs/process/handoff-protocol.md) — first empirical application post-codify

---

## Estimated Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| 0 | Pre-Flight Verification | 30 min |
| 1 | Backend PaymentIntent API | 2-3 h |
| 2 | Backend Webhook Handler | 2-3 h |
| 3 | Backend Refund-on-failure | 2-3 h |
| 4 | Frontend Checkout Page | 3-4 h |
| 5 | Frontend Processing + Result-extension | 2 h |
| 6 | Tax + Receipt Configuration | 1 h |
| 7 | E2E Tests + Smoke | 3 h |
| 8 | Apple-Pay/Google-Pay (conditional) | XS User-Actions |
| **Total** | | **~16-19 h Bob-execution** |

Distributable across 3-5 Bob-terminal-sessions. Phase 0 + 1 in one session, Phase 2 + 3 in one session, Phase 4 + 5 in one session, Phase 6 + 7 in one session, Phase 8 ad-hoc.

---

## Out of Scope (Phase 3+ defers)

- ❌ **User accounts / Magic-link auth** → Phase 3
- ❌ **Subscription (€10/Monat)** Stripe-Subscription product → Phase 3
- ❌ **BYOK (Customer-Keys)** Vault integration → Phase 3
- ❌ **Self-service refunds** (customer-initiated, not just auto-on-failure) → Phase 4
- ❌ **B2B Enterprise pricing** (per-seat, API-tokens) → Phase 4+
- ❌ **Multi-currency** (€ only at launch) → post-MVP based on customer demand
- ❌ **Saved payment methods** (Stripe customer-objects for repeat buyers) → Phase 3 (after auth lands)
- ❌ **Receipts in custom format** (Stripe-receipt sufficient for MVP) → not planned
- ❌ **Refund-dispute self-service** (manual via Stripe Dashboard for MVP) → Phase 4+
- ❌ **Advanced Stripe Radar rules** (default protection sufficient for €1/€3 low-fraud-target) → Phase-7 hardening if needed
- ❌ **Stripe Connect / Marketplace** (not the business model) → never

---

## Plan-Doc Author Notes (R2 fact-class 6 Application Log)

This Plan-Doc was written at Tag-62 letter-b 2026-05-21 by MASCHIN with the R2 fact-class 6 triple-source-check applied **as the very first task at session-start, BEFORE write**. Verifications:

1. **`gh pr view 20 --repo neckarshore-ai/snakeoil-check`** → MERGED 2026-05-20T21:26:15Z `2bc3549`. B1 Plan-Doc on main.
2. **`ls docs/superpowers/specs/2026-05-20-tiered-architecture-design.md`** → exists, current canonical Design-Doc v0.2.
3. **`grep -nE "stripe_payment_intent_id|payment_intent_amount_cents|payment_status" docs/superpowers/plans/2026-05-20-phase-2-a-foundation.md`** → schema fields confirmed in Phase-2-A.
4. **CLAUDE.md vs Design-Doc § 9 drift detected** → fixed in same PR as this Plan-Doc (R2 fact-class 6 in operative application, NOT ceremony). First empirical post-codify case.

Without R2 fact-class 6 the Plan-Doc would have:
- Documented Stripe Checkout-Session pattern (wrong — Design-Doc says Payment-Intent) by reading CLAUDE.md
- Planned for new Drizzle migrations (wrong — schema already complete)
- Bundled Write-Time and Execution-Time preconditions (wrong — would block Plan-Doc-write on B1-traffic-data not yet available)

Estimated time-saved by R2 fact-class 6: ~45-60 min of mid-Plan-Doc rework + ~1-2h of Bob mid-implementation surface-and-correct cycle.

---

**MASCHIN Author-Stamp:** 2026-05-21 letter-b MASCHIN-Planning-session. Plan-Doc-Write event. Pattern-Klasse Plan-Doc-shape n=5 (TDD-disciplined Phase-gated with Pre-Flight + Conditional final Phase). advisor()-pre-call 11 catches integrated.
