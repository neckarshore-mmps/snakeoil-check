# Roadmap — Snake-Oil-or-Gold Check

**Last updated:** 2026-05-18
**Owner:** German Rauhut

## v0.1 — Full LOW MMP (6-8 Wochen)

**Goal:** Launch all three LOW tiers (Free-Shot + 3-Shot + 10-Shot) end-to-end in production with calibrated scoring framework.

### Build Sequence

| # | Phase | Week | Key Deliverables |
|---|-------|------|------------------|
| 1 | Foundation | 1 | Next.js scaffold, Vercel project, Postgres+Drizzle, CI/CD, vercel.ts |
| 2 | AI + Workflow | 1-2 | Scraping module, AI Gateway integration, scoring rubric in code, Workflow steps |
| 3 | Free-Shot Flow | 2-3 | Landing page, form, abuse-limits, email delivery, web-report page |
| 4 | Stripe + Auth | 3-4 | Magic-link auth, Stripe Checkout, webhooks, user/shot creation |
| 5 | Dashboard + Paid Flows | 4-5 | Shot redemption, history, comparison flow, 10-Shot dashboard |
| 6 | Scoring Calibration | 5-6 | Run 15 eval cases, calibrate weights, document |
| 7 | Legal + Hardening | 6-7 | Imprint, Privacy, Terms (lawyer), BotID, rate-limits, monitoring, Sentry |
| 8 | Pilot + Polish | 7-8 | 5 pilot users, feedback iteration, copy polish, Lighthouse pass |

### Success Criteria

Listed in `docs/superpowers/specs/2026-05-18-snakeoil-check-mmp-design.md` §10. Summary:
1. All three LOW tiers work E2E in production
2. Scoring framework calibrated (80%+ agreement on eval set)
3. ≥80% Vitest coverage on `lib/`, 5 critical Playwright E2E flows
4. Landing Lighthouse 95+ desktop/mobile
5. Legal docs in place
6. 5 pilot users have run 3-Shot and given feedback
7. User explicitly says "PASS"

### Pricing (MVP-phase)

| Tier | Price | Notes |
|------|-------|-------|
| Free Shot | 0 € | 1 per email-hash / 30 days |
| 3-Shot Starter | 19 € | 6-month redeem window |
| 10-Shot Power | 49 € | 12-month redeem window |

Prices rise toward Phase-2 levels (29 € / 69 € / 99 €) after ~100 paid users + qualitative confidence.

## v0.2 — Expansion (Q3 2026 target)

| # | Item | Why |
|---|------|-----|
| 1 | Flatrate subscription (Monatsabo, 15-25 Shots, 29-59 €) | Power-users, recurring revenue |
| 2 | English language UI + reports | Open international market |
| 3 | Independent Verifiability — web-search integration | Strengthen Trust pillar of scoring |
| 4 | JS-heavy site scraping (Playwright headless fallback) | If >20% of v0.1 submissions fail |
| 5 | PDF report download | User-request feature |
| 6 | Refund self-service | Reduce manual ops |
| 7 | Score-explainability deep-link | Inline annotation of source pages |
| 8 | Affiliate / referral program | Growth lever |

**Trigger:** v0.1 has ≥100 paid users and ≥5% Free→Paid conversion rate.

## v0.3 — HIGH-Tier (Q4 2026 target)

The HIGH-touch consulting tier docks onto the existing backend. Three packages:

| # | Tier | Price | Volume |
|---|------|-------|--------|
| 1 | Single Snake-Oil-Check (Done-for-you, 3-5 page report + optional Call) | 250-450 € | 1 deep check |
| 2 | Vergleichs-Check (2-3 offers comparison) | 600-900 € | 1 comparison + Besprechungs-Call |
| 3 | Trusted Guide Retainer (Quarterly) | 600-1.000 € / Quartal | 2-3 Kurzchecks + 1 Vollreport + Review-Call |

**Technical reuse:**
- Same scoring framework (deeper rubric, additional criteria)
- Same Workflow infrastructure (longer-running, includes human-review steps)
- Different frontend funnel (consultation booking, Stripe products with longer fulfillment)
- Calendly integration for Q&A-Calls

**Operational:** HIGH-Tier reports involve human review (German Rauhut) for each delivery. AI does first-pass, human approves before client delivery.

**Trigger:** v0.2 has stable user base, social proof from LOW-tier; demand signal observed (users asking for deeper analysis).

## v0.4+ — Beyond

Captured in `docs/backlog.md` (created later). Candidates:

- Browser extension (one-click check)
- Public score-API for partners (affiliate / comparison sites)
- White-label score-API for German consumer-protection orgs
- DACH-Region focus first; UK / FR / ES expansion later
- Real-time score updates when offer pricing changes (re-scrape cron)
- Score "deltas" — alert user when watched offer changes its messaging

## Out of Roadmap (won't-do)

- Mobile native app (web is enough)
- Discord / Slack bots (overkill for the target audience)
- "AI Coach" features (we are explicitly NOT another coaching product)
- Crypto / NFT integration (no)
