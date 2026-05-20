# Phase 4 — Stripe + Auth (SUPERSEDED 2026-05-20)

> **STATUS:** ❌ **SUPERSEDED BY [Phase-2-B2 Stripe Single-Shot stub](./2026-05-20-phase-2-b2-stripe-single-shot.md)** (2026-05-20 letter-e MASCHIN-session).
>
> This stub was written under the v0.1 pre-pivot pricing-model (3-Shot 19€ + 10-Shot 49€ bundles via Stripe Checkout-Session + Magic-Link Auth). The v0.2 Pricing-Pivot (2026-05-20 letter-b, [Design-Doc v0.2 § 4](../specs/2026-05-20-tiered-architecture-design.md)) changed:
> - Bundle-pricing → Single-Shot Pay-Per-Use (€1 Standard + €3 Deep)
> - Stripe Checkout-Session → Stripe Payment-Intent (lower fee + embedded UX)
> - Magic-Link Auth in MVP → **NO auth in MVP** (anonymous purchase, Auth moves to Phase 3 with Subscription tier)
>
> User-account flow (Magic-Link Auth, Subscription tier €10/Monat) defers to **Phase 3 per [Design-Doc v0.2 § 14.2](../specs/2026-05-20-tiered-architecture-design.md)**.
>
> **For implementation:** use [Phase-2-B2 Stripe Single-Shot](./2026-05-20-phase-2-b2-stripe-single-shot.md), not this file. This file preserved for historical traceability only.

## Original Goal (v0.1 pre-pivot)

Paid users can purchase 3-Shot (19 €) or 10-Shot (49 €) via Stripe Checkout, get an email magic-link, log in to a dashboard, and have shot-balance ready to redeem.

## Scope

| # | Component | Notes |
|---|-----------|-------|
| 1 | Stripe products | 2 products (3-Shot Starter, 10-Shot Power), one Price per product, MVP-phase prices |
| 2 | Stripe Checkout flow | Landing CTA → Checkout Session → success page → email magic-link |
| 3 | Webhook handler | `checkout.session.completed` → create User + ShotGrant + Shots in transaction. Idempotency via `stripe_session_id` unique constraint |
| 4 | Magic-Link auth | Custom impl: server action generates token (SHA-256 stored, plain emailed), 15-min expiry, single-use. Cookie-session after redeem. |
| 5 | User table extensions | Add `last_login_at`, magic-link table, session storage |
| 6 | Resend integration for magic-link | Template, deliverability via SPF/DKIM on chosen domain |
| 7 | Dashboard skeleton | `/dashboard` server-component, shows shot-balance, "Submit URL for a check" button |
| 8 | Refund handling docs | Manual process via Stripe Dashboard, codified in Terms of Service draft |

## Definition of Done

- End-to-end purchase → email → login → dashboard works in production
- Webhook idempotency proven via Stripe-CLI test event replays
- 3-Shot and 10-Shot products created in Stripe live mode
- Magic-link tokens hash-stored, 15-min expiry verified
- 3 Playwright e2e flows: purchase, magic-link login, dashboard view
- User says "PASS"

## Dependencies

- Phase 3 Done (Free-Shot flow + email infrastructure)
- Stripe account verified + bank account linked
- Domain decided (snakeoilcheck.com or similar) — required for Stripe Checkout branding + SPF/DKIM
