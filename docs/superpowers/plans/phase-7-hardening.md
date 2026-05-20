# Phase 7 — Legal + Hardening (STUB)

> **STATUS:** Stub — to be filled after Phase 6 ships.

## Goal

Production-ready security, observability, and legal posture before pilot users hit the system.

## Scope

| # | Component | Notes |
|---|-----------|-------|
| 1 | Imprint page | German legal Imprint (§5 TMG). Boilerplate from neckarshore-website + lawyer review |
| 2 | Privacy Policy | DSGVO-compliant. Cover scraping, AI processing (zero-data-retention claim), email storage, Stripe, Resend, Vercel Analytics |
| 3 | Terms of Service | Refund policy (30d on unused shots), defamation disclaimer, AI-judgement disclaimer, governing law |
| 4 | Lawyer review | Send all 3 docs to legal counsel; fold in changes |
| 5 | Cookie banner | NOT added — cookieless via Vercel Web Analytics |
| 6 | BotID enabled | Vercel BotID on Free-Shot form |
| 7 | Rate-limit middleware | IP-based, sliding-window, applied to `/api/check/free` |
| 8 | Sentry integration | `@sentry/nextjs`, alert on Workflow failures, error budget set |
| 9 | Vercel Firewall rules | Block obvious abuse patterns, IPs from sanctioned regions if legal review requires |
| 10 | Backup verification | Neon point-in-time recovery tested. Vercel Blob optional artifact backup. |
| 11 | Incident runbook | One-pager: what to do if Claude rate-limit / Stripe outage / Neon outage / abuse spike |
| 12 | Daily-metrics email cron | `pnpm tsx scripts/daily-metrics.ts` runs via Vercel Cron, emails KPIs |
| 13 | **emailPlain user-delete endpoint (GDPR Art. 5(1)(e))** | `users.emailPlain.notNull()` stores plaintext email for transactional delivery (Resend). MUST implement hard-delete endpoint before any real user touches the product. Hard-delete both `users.emailPlain` AND associated `checks` rows + `check_results` reports. Per Dr. Sommer Health-Check 2026-05-20-c F-NEW-3. Sourced from `omnopsis-planning:docs/reports/2026-05-20-dr-sommer-c.md`. **Blocker for MMP-go-live with real user emails.** |
| 14 | **zero_data_retention providerOptions (GDPR Art. 5(1)(c) + Compliance-Claims)** | Design Doc v0.2 §8 row 4 claims `provider_options.anthropic.zero_data_retention: true` for AI calls. **Currently NOT backed by code:** `generateObject()` calls in `single-call.ts` + `per-criterion.ts` do NOT pass `providerOptions`. Without this, salespage content submitted to Anthropic may be retained per their standard data-use policy. Privacy Policy claim would be false if published as-is. **Action:** add `providerOptions: { anthropic: { zeroDataRetention: true } }` to both strategy `generateObject()` calls. Verify exact field name against `@ai-sdk/anthropic@1.2.12` docs (current dep version) — schema may use `zeroDataRetention` or `zero_data_retention`. Per Dr. Sommer Health-Check 2026-05-20-c F-NEW-4. |
| 15 | **Biome pre-commit hook (code-hygiene)** | Install `lefthook` or `husky`, configure pre-commit hook running `pnpm biome check --write`. Bob letter-c flagged repeated manual formatting fixes ("biome check --write multiple times across the session"); Dr. Sommer Health-Check 2026-05-20-c validated recommendation (a). Low effort, high return — prevents the "pushed dirty, failed CI, cleanup commit" pattern. |

## Definition of Done

- All 3 legal docs published, lawyer sign-off in writing
- BotID, rate-limit, Sentry all live in production
- Test attack scenarios (5 simulated abuse cases) blocked correctly
- Daily-metrics email arrives next morning with real data
- Incident runbook reviewed and bookmarked
- emailPlain user-delete endpoint live + tested (item #13, GDPR Art. 5(1)(e))
- zero_data_retention `providerOptions` in both `generateObject()` strategy calls + verified field name in `@ai-sdk/anthropic@1.2.12` (item #14, GDPR Art. 5(1)(c))
- Biome pre-commit hook installed + working (item #15)
- User says "PASS"

## Dependencies

- Phase 5 Done (full functional product)
- Lawyer engagement booked
- Decision on jurisdiction / governing law (DE default)
