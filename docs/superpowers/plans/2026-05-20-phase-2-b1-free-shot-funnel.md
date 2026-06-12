# Phase-2-B1 Free-Shot Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the **free half** of the Snake-Oil-Check Revenue Path — Email-Gated Free-Shot flow with 4-Layer Email-Validation, 4 MVP Anti-Abuse layers, Resend Audiences integration, Curated Examples Gallery (Tier 0), and Free-Shot Result Page. Activation-funnel ships before monetization-funnel by design (you can't measure conversion without traffic).

**Architecture:** Adds 4 NEW Drizzle tables (`email_verifications`, `email_subscribers`, `rate_limits`, `curated_examples`), 4 NEW frontend routes (`/`, `/examples`, `/examples/[slug]`, `/free-shot`, `/wait/[token]`, `/result/[token]`), 5 NEW API routes (`/api/free-shot/submit`, `/api/free-shot/confirm`, `/api/abuse/turnstile`, `/api/resend/bounce-webhook`, `/api/admin/examples-rerun`), and integrates Resend Audiences for GDPR-compliant List-Building. Anti-Abuse pipeline gates the Free-Shot Workflow trigger. Wait-Page-Conversion-Trick (§ 7.4) is a real component with embedded Examples-Gallery + Skip-to-€1 CTA (feature-flagged forward-link to B2 even before B2 ships).

**Sequencing-Rationale (B1 ships before B2):** Free-Shot funnel = activation-side, zero-Stripe-dependency. Ships → traffic + activation signal → measured conversion-rate → THEN B2 monetization arrives with real conversion-data. Reversed sequence puts the revenue-gate in front of activation; you can't measure what doesn't happen yet.

**Tech Stack additions:**
- `@upstash/redis` ^1.x (rate-limits storage + URL-dedup cache, free-tier sufficient for MVP)
- `disposable-email-domains` ^1.x (blocklist npm package, build-time bundled)
- `dns` (Node built-in, MX-lookup)
- `@hcaptcha/cloudflare-turnstile` integration via Vercel-env keys (no npm package needed, direct API)
- `resend` ^5.x (already in Phase-1, adds Audiences API usage)
- shadcn/ui components (form, button, checkbox, dialog) — installed per snakeoil-check Frontend convention

**Working-Dir Discipline:** Every Bash command starts with `cd ~/Developer/projects/neckarshore-ai/snakeoil-check && ...`.

**Branch Strategy:** New feature-branch `bob/2026-05-XX-phase-2-b1-free-shot-funnel` off main. One PR per logical Phase-group (Phase-1 DB-Migrations-PR, Phase-2+3 Anti-Abuse+Email-Verify-PR, Phase-4 Examples-Gallery-PR, Phase-5+6 Form+Result+Resend-PR). Anti-Cascade discipline (Bob's 2026-05-20-b lesson): rebase each PR off main after prior merges, do NOT stack PRs.

**Pattern-Klasse Application:** TDD-Driven Phase-Gated Plan-Doc Structure (Pattern-Klasse n=4 + Slot 5 cross-class). Phase 0 Pre-Flight Verification (gating) → Phases 1-6 TDD-ordered Tasks (failing-test FIRST commit + RED-gate transcript in commit-body) → Phase 7 Post-Merge Smoke (gated by Phase-0 pass).

---

## Prerequisites Verified (Phase 0 will re-check at execution-time)

- ✅ Phase-1 Foundation merged (Bob PR #1, 2026-05-18)
- ✅ Phase-2-A Foundation merged (Bob PR #16, 2026-05-20-d)
- ✅ Phase-2-A post-audit fixes merged (Bob PR #17, 2026-05-20-d) — SC2 Neon migration applied, SC5 budget-policy comment, F-NEW-1 dead-env-cleanup, F-NEW-2 Phase-3 type-comments
- ✅ Vercel Production env-vars (8 vars: 6 ROUTER_* + ANTHROPIC_API_KEY + GOOGLE_GENERATIVE_AI_API_KEY) set 2026-05-20-e
- ⚠️ **Vercel Preview env-vars (7 vars: 6 ROUTER_* + GOOGLE_GENERATIVE_AI_API_KEY) — PENDING User-Action via Vercel Dashboard.** CLI 54.1.0 doesn't accept non-interactive Preview-add without explicit git-branch arg. **Phase 0 will block on this — Bob CANNOT proceed past Phase 0 until Preview env-vars exist.**
- ⚠️ Stripe-Project + STRIPE_SECRET_KEY: NOT required for B1 (B1 is free-only). Listed here for B2 planning.
- ⚠️ Resend-Project + RESEND_API_KEY: must be live in Vercel-env (Phase-1 already provisioned per Design-Doc § 12.1)
- ⚠️ Cloudflare-Turnstile site-key + secret-key: NEEDS User-Action (sign up + get keys). Phase 0 will block until present.
- ⚠️ Upstash-Redis project + UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN: NEEDS User-Action (free-tier signup, 1 min). Phase 0 will block.
- ⚠️ Bob letter-d SD3 drizzle journal verify (P2): precondition before any new migration. Phase 0 will check.

**Plan-Doc-Routing-Drift Preflight (per letter-d Watch + letter-e n=2 incident):**

```bash
# Verify this Plan-Doc has not been superseded between authoring and execution
test -f docs/superpowers/plans/2026-05-20-phase-2-b1-free-shot-funnel.md || { echo "Plan-Doc moved/renamed — abort"; exit 1; }
grep -q "Phase-2-B1 Free-Shot Funnel" docs/superpowers/plans/2026-05-20-phase-2-b1-free-shot-funnel.md || { echo "Plan-Doc content changed semantically — verify with MASCHIN"; exit 1; }
# Verify Design-Doc v0.2 still current (not superseded by v0.3)
grep -q "v0.2" docs/superpowers/specs/2026-05-20-tiered-architecture-design.md || { echo "Design-Doc version changed — verify Plan-Doc alignment"; exit 1; }
# Verify Phase-2-A still current (this Plan depends on Phase-2-A live)
git log --oneline -20 | grep -q "phase-2-a" || { echo "Phase-2-A not in recent main history — verify state"; exit 1; }
```

---

## File Structure (decomposition before tasks)

**CREATE (new files):**

```
src/db/schema/
  email_verifications.ts            # token-based email-confirm + bounce-tracking
  email_subscribers.ts              # Resend-Audience-list-membership + GDPR opt-in flag
  rate_limits.ts                    # composite IP/Email/URL rate-limit storage
  curated_examples.ts               # Tier-0 Examples Gallery data

src/db/migrations/
  0002_email_and_abuse.sql          # Drizzle-generated migration for 4 NEW tables

src/lib/anti-abuse/
  turnstile.ts                      # Cloudflare Turnstile server-side verify
  rate-limit.ts                     # Upstash-Redis-backed rate-limit primitive
  url-dedup.ts                      # 5min URL-cache de-duplication
  kill-switch.ts                    # FREE_SHOT_ENABLED env-flag + free-tier-quota-guard
  __tests__/
    turnstile.test.ts
    rate-limit.test.ts
    url-dedup.test.ts
    kill-switch.test.ts
    integration.test.ts             # full Anti-Abuse pipeline E2E (mocked dependencies)

src/lib/email/
  disposable-detect.ts              # Layer 1: bundled blocklist check
  mx-lookup.ts                      # Layer 2: dns.resolveMx wrapper with timeout
  email-validator.ts                # 4-Layer composition (calls 1+2 sync, 3+4 deferred)
  token.ts                          # generate + hash + verify token-flow (single-use, 30min TTL)
  resend-audiences.ts               # Resend Audiences API wrapper (add/remove from list)
  bounce-handler.ts                 # Resend webhook signature-verify + DB-update
  __tests__/
    disposable-detect.test.ts
    mx-lookup.test.ts
    email-validator.test.ts
    token.test.ts
    resend-audiences.test.ts
    bounce-handler.test.ts

src/lib/free-shot/
  free-shot-flow.ts                 # business-logic: lifetime-limit check + workflow-trigger
  __tests__/
    free-shot-flow.test.ts

src/lib/admin/
  examples-rerun.ts                 # Admin-CLI re-run logic (re-scrape + re-score curated examples)
  __tests__/
    examples-rerun.test.ts

src/app/(marketing)/
  page.tsx                          # Landing page (German copy, mobile-first, Lighthouse 95+ target)
  layout.tsx                        # marketing-group layout (header + footer)
  examples/
    page.tsx                        # /examples — Gallery overview (SSG + ISR)
    [slug]/
      page.tsx                      # /examples/[slug] — individual example
  free-shot/
    page.tsx                        # /free-shot — Form (URL + Email + Turnstile + GDPR-2-checkboxes)
  wait/
    [token]/
      page.tsx                      # /wait/[token] — Wait-Page-Conversion-Trick component
  result/
    [token]/
      page.tsx                      # /result/[token] — Free-Shot Result Page (public, token-protected)

src/app/(legal)/
  maintenance/
    page.tsx                        # /maintenance — Kill-Switch maintenance-notice

src/app/api/
  free-shot/
    submit/
      route.ts                      # POST /api/free-shot/submit (Anti-Abuse pipeline + Email-Verify trigger)
    confirm/
      route.ts                      # GET /api/free-shot/confirm?token=<...> (email-confirm → Workflow-Start)
  abuse/
    turnstile/
      route.ts                      # POST /api/abuse/turnstile (server-side Turnstile verify endpoint)
  resend/
    bounce-webhook/
      route.ts                      # POST /api/resend/bounce-webhook (Resend signature verify + DB-update)
  admin/
    examples-rerun/
      route.ts                      # POST /api/admin/examples-rerun (BasicAuth-protected, re-scrape curated)

src/components/
  free-shot-form.tsx                # Server-Action + Client-validated Form
  gdpr-checkboxes.tsx               # 2 separate checkboxes (transactional required + marketing optional)
  examples-gallery.tsx              # reusable component (used in /examples, /wait/[token] embed)
  skip-to-paid-cta.tsx              # feature-flagged Skip-to-€1 button (forward-link to B2)
  wait-page-content.tsx             # Wait-Page-Conversion-Trick container

src/lib/legal/
  gdpr-texts.ts                     # canonical GDPR consent text constants (DE + future-i18n-ready)

scripts/
  seed-curated-examples.ts          # one-shot CLI to insert 5 seed examples
  validate-disposable-list.ts       # CI-check that disposable-list is current (warns if >30 days stale)

content/
  examples-seed.json                # 5 seed-example URLs + curator-notes (User-Input required)
```

**MODIFY (existing files):**

```
src/lib/workflow/snake-oil-check.ts # add free-shot entry-point + free-tier-quota-guard hook
src/lib/workflow/steps/score.ts     # use Router-FREESHOT tier when called via free-shot-flow
src/db/schema.ts                    # add 4 NEW table-exports
package.json                        # add deps: @upstash/redis + disposable-email-domains + shadcn-components
.env.example                        # add TURNSTILE_* + UPSTASH_REDIS_* + RESEND_AUDIENCE_ID env-vars
docs/superpowers/plans/README.md    # mark phase-3 + phase-4 stubs SUPERSEDED, fix stale spec-reference
docs/superpowers/plans/phase-3-free-shot.md  # mark SUPERSEDED-BY Phase-2-B1
docs/superpowers/plans/phase-4-stripe-auth.md  # mark SUPERSEDED-BY Phase-2-B2 (stub)
```

**CREATE (companion stub for B2):**

```
docs/superpowers/plans/2026-05-20-phase-2-b2-stripe-single-shot.md  # stub with goal + scope-pointer + "to be written letter-f"
```

---

## Phase 0 — Pre-Flight Verification (Gating, ~15 min, NO code)

Phase 0 is a hard-gate. If ANY check fails, Bob stops and surfaces to MASCHIN/User. Do not proceed to Phase 1 with red Phase 0.

### Task 0.1 — Verify Vercel env-var format (Anthropic + Google)

- [ ] Run preflight-script `scripts/preflight-vercel-env.sh` (Bob will create this in 0.1) that:
  - `curl -s https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" | jq -e '.data[0].id'` → must return non-null (claude-haiku-4-5 or similar)
  - `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_GENERATIVE_AI_API_KEY" | jq -e '.models[0].name'` → must return non-null
  - `vercel env ls production | grep -c "^ ROUTER_"` → must return 6
  - `vercel env ls preview | grep -c "^ ROUTER_"` → must return 6 (FAILS if Preview Dashboard-Action not done)
- [ ] If any check fails: surface to User as `T-USER-vercel-env-fix` blocker. Do not proceed.

### Task 0.2 — Verify Bob letter-d SD3 drizzle journal sync

- [ ] Run `pnpm drizzle-kit migrate:status` (or equivalent) — verify journal in repo matches `__drizzle_migrations` table in Neon production
- [ ] If drift: run `pnpm drizzle-kit pull` and reconcile journal; otherwise next-migration-generation may produce wrong diff
- [ ] Document state in commit-body as Phase-0 evidence

### Task 0.3 — Verify Phase-2-A test baseline still green

- [ ] `pnpm vitest run` — all Phase-2-A tests must pass (45/45 from Bob's prior PR + any post-audit-fix tests)
- [ ] Document count + commit-hash-of-baseline in commit-body
- [ ] **This is the TDD RED-gate baseline** for Phase 1 onward

### Task 0.4 — Plan-Doc-Routing-Drift preflight

- [ ] Run the 4-line bash check from "Prerequisites Verified" section above
- [ ] All 4 must pass
- [ ] If Plan-Doc has been superseded mid-execution: stop + surface to MASCHIN

### Task 0.5 — User-Action gates surface check

- [ ] Verify Cloudflare-Turnstile keys present (`$TURNSTILE_SITE_KEY` + `$TURNSTILE_SECRET_KEY`)
- [ ] Verify Upstash-Redis keys present (`$UPSTASH_REDIS_REST_URL` + `$UPSTASH_REDIS_REST_TOKEN`)
- [ ] Verify Resend Audience ID present (`$RESEND_AUDIENCE_ID`, will be created during Phase 6 if absent)
- [ ] If any missing: surface as `T-USER-<key-name>-setup` blockers; do not proceed past 0.5

**Phase 0 DoD:** All 5 tasks green. Commit `phase-0-preflight-evidence.md` to branch with raw outputs.

---

## Phase 1 — DB Migrations: 4 NEW Tables (TDD, ~3 hours)

> **TDD discipline:** Each task = failing-test FIRST commit + embedded RED-gate transcript in commit-body, then implementation commit (GREEN), then refactor-if-needed commit.

### Task 1.1 — `email_verifications` table

**Failing-test FIRST** (`src/db/schema/__tests__/email_verifications.test.ts`):

- [ ] Test: schema-shape verification (columns: `id` UUID PK, `email_hash` text indexed, `token_hash` text unique, `status` enum `pending|confirmed|bounced|expired`, `created_at` timestamp, `confirmed_at` nullable timestamp, `bounced_at` nullable timestamp, `expires_at` timestamp)
- [ ] Test: insert/select round-trip with all fields
- [ ] Test: unique-constraint on `token_hash` rejects duplicates
- [ ] Test: status enum rejects invalid values
- [ ] Commit `test(db): email_verifications schema — RED-baseline failing tests`

**Implementation** (`src/db/schema/email_verifications.ts`):

- [ ] Define Drizzle schema
- [ ] Export to `src/db/schema.ts`
- [ ] Run tests → GREEN
- [ ] Commit `feat(db): email_verifications table — schema + tests passing`

### Task 1.2 — `email_subscribers` table

- [ ] Failing-test FIRST: schema-shape (`id`, `email_hash`, `audience_tag` text, `gdpr_marketing_opt_in` boolean, `created_at`, `removed_at` nullable)
- [ ] Test: composite-unique (`email_hash`, `audience_tag`)
- [ ] Test: GDPR-opt-in defaults to `false`
- [ ] Implementation + GREEN + commit pair (RED then GREEN)

### Task 1.3 — `rate_limits` table

- [ ] Failing-test FIRST: schema-shape (`id`, `key_hash` text indexed, `key_type` enum `ip|email|url`, `count` integer, `window_start` timestamp)
- [ ] Test: composite-index on (`key_hash`, `key_type`, `window_start`)
- [ ] Test: increment-or-insert idempotency at concurrent-write
- [ ] Implementation + GREEN + commit pair

### Task 1.4 — `curated_examples` table

- [ ] Failing-test FIRST: schema-shape (`id`, `url` text unique, `slug` text unique, `scoring_result_json` jsonb, `curator_note` text, `published_at` timestamp, `last_rerun_at` nullable timestamp)
- [ ] Test: insert/select round-trip
- [ ] Test: JSON shape-validation on `scoring_result_json` (must be valid scoring-rubric output)
- [ ] Implementation + GREEN + commit pair

### Task 1.5 — Generate + Apply Migration

- [ ] `pnpm drizzle-kit generate:pg` — produces `src/db/migrations/0002_email_and_abuse.sql`
- [ ] Review SQL diff: must add 4 tables + indexes + constraints, no destructive changes
- [ ] `pnpm drizzle-kit migrate` (against test-DB first)
- [ ] Apply to Neon Production via `set -a && source .env.production.local && set +a && pnpm drizzle-kit migrate` (workaround per Bob letter-d learning)
- [ ] Verify `__drizzle_migrations` row added in production
- [ ] Commit `feat(db): 0002_email_and_abuse migration — applied to test + prod`

**Phase 1 DoD:** All 4 tables exist in Neon Production + migration journal synced + tests green + zero schema-drift.

---

## Phase 2 — Anti-Abuse Sub-System (4 MVP Layers + GDPR + Kill-Switch, ~4 hours)

### Task 2.1 — Cloudflare Turnstile Server-Side Verify (Layer 1)

- [x] Failing-test FIRST: `turnstile.test.ts` — given a Turnstile token, POSTs to `siteverify` endpoint with `$TURNSTILE_SECRET_KEY`, returns `success: boolean` + `cdata`
- [x] Mock fetch with vi.mock + happy-path response
- [x] Mock error-path (expired token, invalid response)
- [x] Implementation `src/lib/anti-abuse/turnstile.ts`
- [x] GREEN + commit pair

### Task 2.2 — IP+Cookie Rate-Limit (Layer 2, Upstash-Redis-backed)

- [x] Failing-test FIRST: `rate-limit.test.ts` — incrementCounter(`ip:<hash>:24h`) increments + reads correctly via Upstash-Redis mock
- [x] Test: at 4th call within 24h window returns `blocked: true` (max 3 email-signups / 24h per IP-hash)
- [x] Test: TTL behavior — counter resets after 24h
- [x] Implementation `src/lib/anti-abuse/rate-limit.ts`
- [x] GREEN + commit pair

### Task 2.3 — URL-Dedup 5min Cache (Layer 5 per Design-Doc § 7.5)

- [x] Failing-test FIRST: `url-dedup.test.ts` — same URL submitted twice within 5min returns cached result (no new Workflow trigger)
- [x] Test: After 5min window expires, new submission triggers fresh Workflow
- [x] Test: URL normalization (trailing-slash, fragment-strip) before cache-key
- [x] Implementation `src/lib/anti-abuse/url-dedup.ts`
- [x] GREEN + commit pair

### Task 2.4 — Kill-Switch with Free-Tier-Quota-Guard (Layer 6 + NEW Layer 7)

> **Per advisor() catch #4 (2026-05-20-e):** Gemini Flash free-tier IS rate-limited (empirical 429 quota-exhausted observed during smoke-test). Plan-doc MUST specify `max N Free-Shots / day system-wide before Kill-Switch auto-flips`.

- [x] Failing-test FIRST: `kill-switch.test.ts`:
  - `FREE_SHOT_ENABLED=false` → returns `blocked: true, reason: 'maintenance'`
  - `FREE_SHOT_ENABLED=true` + daily-count < N → returns `blocked: false`
  - `FREE_SHOT_ENABLED=true` + daily-count >= N → returns `blocked: true, reason: 'daily_quota_exhausted'` + auto-disables Kill-Switch for current calendar-day
- [x] Test: redis-backed counter `freeshot:daily:YYYY-MM-DD` increments idempotently
- [x] Test: blocked-response triggers redirect-to-`/maintenance` (return-code decision: 503 with retry-after-midnight)
- [x] Implementation `src/lib/anti-abuse/kill-switch.ts`
- [x] **N = 50 default** (Phase-2 MVP conservative — adjustable per env-var `FREE_SHOT_DAILY_SYSTEM_LIMIT=50`)
- [x] GREEN + commit pair

### Task 2.5 — GDPR Double-Opt-In Component + Legal-Text

> **Per advisor() catch #1 (2026-05-20-e):** Two SEPARATE checkboxes (transactional required + marketing optional). MUST be in B1 because Resend Audiences integration triggers it. This is the one thing that gets us sued if wrong.

- [ ] Failing-test FIRST: `gdpr-checkboxes.test.tsx` (component test via @testing-library/react):
  - Renders 2 checkboxes with distinct labels (transactional + marketing)
  - Transactional defaults to `unchecked` and form is `invalid` until checked
  - Marketing defaults to `unchecked` and form is `valid` regardless (optional)
  - Form-data extracts both consent-states correctly
- [ ] Define canonical GDPR-text constants `src/lib/legal/gdpr-texts.ts` (DE-only at MVP, i18n-ready structure):
  - `GDPR_TRANSACTIONAL_DE = "Ich akzeptiere die Verarbeitung meiner Email für diesen Free-Check (notwendig für die Email-Bestätigung)."`
  - `GDPR_MARKETING_DE = "Ich möchte gelegentlich Snake-Oil-Check Updates per Email erhalten (jederzeit widerrufbar)."`
- [ ] Implementation `src/components/gdpr-checkboxes.tsx`
- [ ] GREEN + commit pair

### Task 2.6 — Anti-Abuse Pipeline Integration

- [x] Integration-test FIRST `integration.test.ts`: full pipeline for a single Free-Shot submission:
  - turnstile.verify() → rate-limit.check() → url-dedup.check() → kill-switch.check() → all-pass
  - Any failure short-circuits + returns specific error-code (400/403/429/503)
- [x] Implementation: middleware-style composition in `src/lib/anti-abuse/index.ts`
- [x] GREEN + commit pair

**Phase 2 DoD:** All 4 MVP Anti-Abuse layers + Kill-Switch + GDPR checkbox-component pass tests + GDPR-text legally reviewed (User-action). Integration-test covers happy-path + each error-path.

---

## Phase 3 — Email-Verification 4-Layer Pipeline (~4 hours)

### Task 3.1 — Disposable-Email Detection (Layer 1)

- [x] Failing-test FIRST: `disposable-detect.test.ts`:
  - `isDisposable('mailinator.com')` returns true
  - `isDisposable('gmail.com')` returns false
  - Performance: <1ms per check (bundled blocklist, no I/O)
- [x] Install `disposable-email-domains` npm package, bundle as build-time JSON
- [x] Implementation `src/lib/email/disposable-detect.ts`
- [x] Add CI-check `scripts/validate-disposable-list.ts` warning if blocklist >30 days stale
- [x] GREEN + commit pair

### Task 3.2 — MX-Lookup (Layer 2)

- [x] Failing-test FIRST: `mx-lookup.test.ts`:
  - `hasValidMx('gmail.com')` returns true (real DNS call in integration-tier, mocked in unit-tier)
  - `hasValidMx('gmial.com')` returns false (typo, no MX record)
  - Timeout: 2s max per lookup; on timeout returns `{ valid: false, reason: 'timeout' }`
- [x] Implementation `src/lib/email/mx-lookup.ts` (Node built-in `dns/promises`)
- [x] GREEN + commit pair

### Task 3.3 — Token-Flow (generate + hash + verify)

- [x] Failing-test FIRST: `token.test.ts`:
  - `generateToken()` returns 32-byte url-safe base64 + `tokenHash = sha256(token)`
  - `verifyToken(token, storedHash)` returns true on match, false on mismatch
  - Token expires after 30min (TTL stored in `email_verifications.expires_at`)
  - Token is single-use (status flips `pending → confirmed` on first verify)
- [x] Implementation `src/lib/email/token.ts`
- [x] GREEN + commit pair

### Task 3.4 — Email-Validator Composition (Layer 1+2 synchronous, 3+4 deferred)

- [x] Failing-test FIRST: `email-validator.test.ts`:
  - `validateEmail('user@mailinator.com')` returns `{ valid: false, layer: 1, reason: 'disposable' }`
  - `validateEmail('user@gmial.com')` returns `{ valid: false, layer: 2, reason: 'no_mx' }`
  - `validateEmail('user@gmail.com')` returns `{ valid: true }` (layers 1+2 pass; 3+4 happen at later signal)
- [x] Implementation `src/lib/email/email-validator.ts`
- [x] GREEN + commit pair

### Task 3.5 — Resend Bounce-Webhook Handler (Layer 4)

- [x] Failing-test FIRST: `bounce-handler.test.ts`:
  - Verifies Resend webhook signature against `$RESEND_WEBHOOK_SECRET`
  - On `email.bounce` (hard) event: updates `email_verifications.status = 'bounced'` + `bounced_at = now()` + blocks future Free-Shots from that email-hash
  - On `email.complaint`: same as bounce-hard
  - Invalid signature: returns 401
- [x] Implementation `src/lib/email/bounce-handler.ts` + API-route `/api/resend/bounce-webhook`
- [x] GREEN + commit pair

### Task 3.6 — Send Confirm-Email (Resend template + Layer 3 IP-Rate-Limit)

- [x] Failing-test FIRST: integration-test for full email-send flow:
  - Layer 3: IP-Rate-Limit check (max 3 email-signups / 24h per IP-hash, reuses Task 2.2 rate-limit primitive)
  - Generate token (Task 3.3) + insert `email_verifications` row (status=pending)
  - Send via Resend with confirm-link `https://snakeoil.example.com/api/free-shot/confirm?token=<token>`
  - Track Resend message-id for bounce-correlation
- [x] Implementation embedded in `/api/free-shot/submit` route
- [x] GREEN + commit pair

**Phase 3 DoD:** All 4 Email-Verify layers pass tests + Resend webhook tested with real Resend-CLI replay + integration-test covers full submit → email-send → confirm-click flow.

> **Note (checkbox-tick pass, 2026-06-12 — PLAN-DOC-CHECKBOX-TICK):** Phases 2+3 ticked against merged
> reality: 2.1 (#42), 2.2/2.3/2.4/2.6 (#43), 3.1–3.4 (#44), 3.5/3.6 (#53). Divergences vs spec text:
> (a) Task 2.5 (GDPR checkbox component) deliberately NOT ticked — frontend component is Linus-scope,
> unbuilt as of this pass; (b) Task 2.4 blocked-response returns a plain 503 (no `/maintenance` redirect —
> page does not exist yet, Phase-5 concern); (c) the Phase-1 `rate_limits` table was built (#43-era) but
> later DROPPED (#56, GDPR F-NOW-3) — rate-limit state lives in Upstash Redis, not Neon; (d) the
> "real Resend-CLI replay" leg of the Phase-3 DoD is still open (tracked with the Phase-5 launch runbook).

---

## Phase 4 — Curated Examples Gallery (Tier 0, ~2 hours)

### Task 4.1 — Examples Gallery API + DB seeding

- [ ] Failing-test FIRST: `examples-rerun.test.ts`:
  - `examplesRerun([slug1, slug2])` re-scrapes + re-scores listed examples + updates `curated_examples.scoring_result_json` + `last_rerun_at`
  - Errors mid-batch: continues for remaining, returns partial-success status
- [ ] Implementation `src/lib/admin/examples-rerun.ts`
- [ ] API-route `/api/admin/examples-rerun` protected by BasicAuth-via-env-var (`$ADMIN_BASIC_AUTH = "user:hash"`)
- [ ] GREEN + commit pair

### Task 4.2 — `seed-curated-examples.ts` script + content/examples-seed.json

- [ ] Create `content/examples-seed.json` with 5 seed examples — **User-Action required:** User provides 5 URLs + curator-notes (per Design-Doc § 1: Andrew Tate, Mindvalley, etc. — User picks specifics). Plan-Doc placeholders:
  - `{ "url": "TBD-User-pick-1", "slug": "andrew-tate-real-world", "curator_note": "Major snake-oil signal cluster" }`
  - 4 more
- [ ] Script `scripts/seed-curated-examples.ts` reads JSON + inserts via Drizzle + triggers initial scoring-run for each
- [ ] Run script in production once
- [ ] Commit `feat(content): seed curated examples (5 initial)`

### Task 4.3 — Examples Gallery Frontend (`/examples` + `/examples/[slug]`)

- [ ] `/examples/page.tsx` — SSG with ISR (revalidate=86400), grid-layout, 12-criteria mini-table per card, hover-shows-tendency
- [ ] `/examples/[slug]/page.tsx` — full 12-criteria table + evidence-quotes + curator-note
- [ ] shadcn/ui Card + Badge components for tendency-color-coding (green=Go, yellow=Vorsicht, red=Lieber lassen)
- [ ] Lighthouse 95+ target (test in Vercel-Preview)
- [ ] No unit-tests (presentation-layer); E2E covered in Phase 7
- [ ] Commit `feat(frontend): Examples Gallery /examples + /examples/[slug]`

**Phase 4 DoD:** 5 curated examples live on `/examples` route in Vercel-Production + Lighthouse 95+ + Admin-CLI can re-run scoring on demand.

---

## Phase 5 — Free-Shot Form + Wait-Page + Result-Page (~3 hours)

### Task 5.1 — `/free-shot` Form Page

- [ ] `src/components/free-shot-form.tsx`:
  - Fields: URL (text, required, URL-pattern) + Email (text, required, email-pattern) + Turnstile-widget + GDPR-checkboxes (Task 2.5)
  - Server-Action submit handler in `src/app/(marketing)/free-shot/page.tsx`
  - Loading-state during submit (button disables, spinner inline)
- [ ] Validation: client-side (HTML5 + Zod-schema) + server-side (re-validate everything)
- [ ] Test (Playwright in Phase 7): full submit happy-path
- [ ] Commit `feat(frontend): /free-shot Form page + GDPR + Turnstile`

### Task 5.2 — `/api/free-shot/submit` API Route

- [ ] Failing-test FIRST: `submit.route.test.ts`:
  - Anti-Abuse pipeline runs (Phase 2 integration) → blocks if any layer fails (returns 400/403/429/503)
  - Email-Validator runs (Phase 3 Layer 1+2) → blocks if disposable or no-MX (returns 400)
  - GDPR transactional consent required → blocks if missing (returns 422)
  - Layer 3 IP-Rate-Limit check → blocks if >3 signups/24h/IP (returns 429)
  - On all-pass: generate token + insert email_verifications + send Resend email + return 202 + `{ wait_token: "<token>" }` (separate from email-token for security)
  - Lifetime-limit check: if `email_hash` already used Free-Shot ever → returns 410 + `{ upgrade_cta_url: "/free-shot?upgrade=1" }`
- [ ] Implementation `src/app/api/free-shot/submit/route.ts`
- [ ] GREEN + commit pair

### Task 5.3 — Wait-Page (Conversion-Trick Component, advisor() catch #2)

> **Per advisor() catch #2 (2026-05-20-e):** Wait-Page is structurally a SEPARATE component from "loading spinner" — it's a conversion-page with Examples-Gallery embedded + Skip-to-€1 CTA (feature-flagged forward-link to B2 even before B2 ships).

- [ ] `/wait/[token]/page.tsx`:
  - Top: clear "Wir bestätigen deine Email — bitte klick den Link in deiner Inbox" message
  - Middle: Email-resend button (rate-limited: max 1 resend / 60s)
  - Bottom-LEFT: Examples-Gallery embed (`<ExamplesGallery limit=6 />`)
  - Bottom-RIGHT: **Skip-to-€1 CTA** (`<SkipToPaidCta featureFlag="B2_LIVE" />`) — feature-flagged via env-var `B2_LIVE=true|false`. Default `false` in B1 (button shows but redirects to "Coming soon" page). When B2 ships, flip to `true` → CTA forwards to `/checkout/single-shot?prefill_url=<url>`.
- [ ] Polling: client-side polls `/api/free-shot/status?token=<wait_token>` every 5s for status (`pending|confirmed|workflow_complete`). On `workflow_complete`, redirect to `/result/[result_token]`.
- [ ] No unit-tests (presentation); E2E in Phase 7
- [ ] Commit `feat(frontend): Wait-Page-Conversion-Trick with Examples-Gallery embed + B2-feature-flagged Skip-CTA`

### Task 5.4 — `/api/free-shot/confirm` Email-Confirm Handler

- [ ] Failing-test FIRST: `confirm.route.test.ts`:
  - GET `/api/free-shot/confirm?token=<email-token>`:
    - verifyToken (Task 3.3) → if invalid/expired: redirect to `/error?reason=invalid_token`
    - Flip `email_verifications.status = 'confirmed'` + `confirmed_at = now()`
    - Trigger Vercel-Workflow for Free-Shot scoring (uses TIER FREESHOT = Gemini-2.0-Flash)
    - Redirect to `/wait/[wait_token]` (still polling)
- [ ] Implementation `src/app/api/free-shot/confirm/route.ts`
- [ ] GREEN + commit pair

### Task 5.5 — Free-Shot Result Page (`/result/[token]`)

- [ ] `/result/[token]/page.tsx`:
  - Server-Component fetches `check_results` by result_token
  - Renders 12-criteria full table (same shape as Examples Gallery [slug] page)
  - Top: clear tendency banner (Go / Vorsicht / Lieber lassen) with color-code
  - Bottom: **Strong CTA to €1 Deep-Check** (feature-flagged B2_LIVE, default disabled)
  - Bottom-secondary: "Share this result" copy-link button (public URL)
  - Token-protected: 404 if token invalid; no auth required (public-by-design per Design-Doc § 1)
- [ ] Lighthouse 95+ target
- [ ] No unit-tests (presentation); E2E in Phase 7
- [ ] Commit `feat(frontend): /result/[token] Free-Shot Result Page + share-link + B2-CTA-stub`

**Phase 5 DoD:** Full flow `/free-shot` → email → `/wait` → `/result` works end-to-end in Vercel-Preview with all anti-abuse + email-verify gates active.

---

## Phase 6 — Resend Audiences Integration (~2 hours)

### Task 6.1 — Audience Setup (User-Action + script)

- [ ] **User-Action:** Create 2 Resend Audiences via Resend Dashboard:
  - `free-shots` (all confirmed Free-Shot signups, with `gdpr_marketing_opt_in` distinction)
  - `paid` (for future B2 Stripe customers, empty for now)
- [ ] Capture Audience IDs in `$RESEND_AUDIENCE_FREESHOT_ID` + `$RESEND_AUDIENCE_PAID_ID` env-vars (both Production + Preview via Vercel Dashboard or CLI-once-CLI-issue-resolved)
- [ ] Document in `.env.example`

### Task 6.2 — `resend-audiences.ts` API Wrapper

- [ ] Failing-test FIRST: `resend-audiences.test.ts`:
  - `addContact(audienceId, email, { gdprMarketingOptIn: true })` calls Resend API correctly
  - `removeContact(audienceId, email)` calls Resend API for unsubscribe
  - Idempotent: adding existing contact returns success (not error)
- [ ] Implementation `src/lib/email/resend-audiences.ts` (uses Resend SDK)
- [ ] GREEN + commit pair

### Task 6.3 — Integration into Email-Confirm Flow

- [ ] After Task 5.4 confirms email: call `resend-audiences.addContact($RESEND_AUDIENCE_FREESHOT_ID, email, { gdprMarketingOptIn })`
- [ ] On Resend bounce-webhook (Task 3.5): call `resend-audiences.removeContact()` to keep list clean
- [ ] Insert into `email_subscribers` table for DB-side tracking
- [ ] Test integration via Resend-Sandbox-mode keys (test-mode)
- [ ] Commit `feat(resend): Audience-integration on confirm + bounce`

### Task 6.4 — Unsubscribe Link Handling

- [ ] All marketing-tagged emails include `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder in Resend template
- [ ] Resend handles unsubscribe-link natively (Resend Audiences feature)
- [ ] Verify: send test-email to own address, click unsubscribe-link, confirm contact-removed from Audience
- [ ] Commit `chore(resend): unsubscribe-link template integration`

**Phase 6 DoD:** Resend Audience `free-shots` populates on email-confirm + drops on bounce/unsubscribe + GDPR-marketing-opt-in distinction tracked + unsubscribe-link works end-to-end.

---

## Phase 7 — Post-Merge Smoke Tests (~3 hours)

### Task 7.1 — E2E Playwright Happy-Path

- [ ] `e2e/free-shot-happy-path.spec.ts`:
  - Navigate to `/free-shot`
  - Fill URL = one of the 5 seed-example URLs (Phase 4 must have run)
  - Fill Email = test-mailbox address (Resend test-mode allows this)
  - Check GDPR transactional checkbox
  - Solve Turnstile (Playwright + Turnstile test-mode token)
  - Submit
  - Assert redirect to `/wait/[token]`
  - Poll Resend test-mode API for email-received
  - Click confirm-link from email-body
  - Assert redirect to `/wait/[wait_token]` still polling
  - Wait for `/wait` page to redirect to `/result/[token]`
  - Assert 12-criteria table visible + tendency-banner shows correct tendency
- [ ] Commit `test(e2e): free-shot happy-path Playwright`

### Task 7.2 — E2E Anti-Abuse Triggers

- [ ] `e2e/free-shot-abuse-limits.spec.ts`:
  - Submit 4 Free-Shots from same IP within 24h → 4th returns 429 (Layer 2 IP-Rate-Limit)
  - Submit same URL twice within 5min → 2nd returns cached result (Layer 5 URL-Dedup)
  - Submit Free-Shot with `FREE_SHOT_ENABLED=false` env-flag → redirects to `/maintenance` (Layer 6 Kill-Switch)
  - Submit Free-Shot with disposable email (`@mailinator.com`) → returns 400 (Layer 1 Email-Verify Disposable)
  - Re-submit same email-hash after first successful → returns 410 + upgrade-CTA (Lifetime-Limit)
- [ ] Commit `test(e2e): free-shot abuse-limits Playwright`

### Task 7.3 — GDPR Compliance Manual UAT (User-Action)

- [ ] User reviews live Form at `/free-shot` in Vercel-Production:
  - [ ] 2 SEPARATE checkboxes (not bundled)
  - [ ] Transactional checkbox text matches `GDPR_TRANSACTIONAL_DE` constant
  - [ ] Marketing checkbox is explicitly OPTIONAL (clearly labeled)
  - [ ] Form submission BLOCKED until transactional checkbox checked
  - [ ] Form submission ALLOWED with marketing-checkbox left unchecked
  - [ ] After signup: confirmation-email arrives, contains link
  - [ ] Marketing-opted-in user lands in Resend Audience with `gdpr_marketing_opt_in=true`
  - [ ] Marketing-NOT-opted-in user is NOT in Resend Audience (or is in with flag=false)
  - [ ] Unsubscribe-link in marketing email works (removes from Audience)
- [ ] User signs off: PASS / FAIL (this is a Manual Test per User-discipline, NOT auto-PASS)

### Task 7.4 — Vercel-Preview Manual UAT (User-Action)

- [ ] User reviews full Free-Shot flow on Vercel-Preview-URL with real Resend test-mode + Turnstile test-mode
- [ ] Verify Lighthouse 95+ on `/`, `/examples`, `/free-shot`, `/result/[token]`
- [ ] User signs off: PASS / FAIL

**Phase 7 DoD:** All E2E green + 2 Manual UATs (GDPR + Full-Flow) User-signed-off PASS.

---

## Success Criteria (Phase-2-B1 Done When)

- [ ] All 4 NEW Drizzle tables live in Neon Production
- [ ] All 4 MVP Anti-Abuse layers + Kill-Switch + GDPR component working in Production
- [ ] 4-Layer Email-Validation pipeline working end-to-end
- [ ] 5 Curated Examples visible on `/examples` route
- [ ] Free-Shot submit → email → confirm → workflow → result works end-to-end
- [ ] Resend Audience `free-shots` populates correctly with GDPR-opt-in distinction
- [ ] E2E test suite (happy-path + abuse-limits) green in CI
- [ ] GDPR Manual UAT signed-off PASS
- [ ] Lighthouse 95+ on `/`, `/examples`, `/free-shot`, `/result/[token]`
- [ ] Free-tier-quota-guard verified: daily limit of 50 Free-Shots enforces correctly (manual test)
- [ ] `B2_LIVE=false` feature-flag confirmed: Skip-to-€1 CTAs route to "Coming soon" page (not 404)
- [ ] Bob's TDD-discipline preserved: every Phase 1-3 task has failing-test-FIRST + RED-gate-transcript in commit-body

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Free-tier Gemini Flash quota-exhaustion mid-launch (empirical 429 observed letter-e) | Kill-Switch auto-flips at daily-limit + alerts MASCHIN/User via email |
| Resend Audience GDPR misalignment (sued-risk) | Manual GDPR-UAT in Phase 7 + canonical text constants reviewed by User pre-launch |
| Anti-Abuse false-positives (legit user blocked by Turnstile/rate-limit) | All blocked responses include actionable error-message + manual-override path via support-email |
| URL-dedup cache poisoning (attacker submits dummy URLs to fill 5min window) | Cache-key includes per-IP hash component, not global |
| Drizzle migration drift (per Bob letter-d SD3 lesson) | Phase 0 Task 0.2 hard-checks journal sync before any new migration |
| Stripe-account-not-ready blocks B2 → users hit dead Skip-CTA | B2_LIVE feature-flag default `false` routes to "Coming soon" page (not error) |
| Plan-Doc-Routing-Drift (this Plan-Doc gets superseded mid-execution) | Phase 0 Task 0.4 4-line bash preflight catches it before Phase 1 work |

## Cross-References

- **Source-of-truth Spec:** [Design-Doc v0.2 (2026-05-20-tiered-architecture-design.md)](../specs/2026-05-20-tiered-architecture-design.md) §§ 7, 8, 9, 12.1, 14.1
- **Sibling Plan (B2, stub):** [Phase-2-B2 Stripe Single-Shot stub](./2026-05-20-phase-2-b2-stripe-single-shot.md)
- **Prior Plan (Phase-2-A, completed):** [Phase-2-A Foundation](./2026-05-20-phase-2-a-foundation.md)
- **Superseded Stubs:** [phase-3-free-shot.md (SUPERSEDED-BY this Plan B1)](./phase-3-free-shot.md), [phase-4-stripe-auth.md (SUPERSEDED-BY Plan B2 stub)](./phase-4-stripe-auth.md)
- **MASCHIN Plan-Doc-Routing-Drift Watch:** see `omnopsis-planning:docs/process/sessions/maschin.yaml` letter-d + letter-e watches
- **AT-1 Discipline:** MASCHIN (Red-List for snakeoil-check) authored this Plan-Doc per User-explicit-Auth + 4-condition-check (target-persona Bob not running ✅ + minimal-correct-fix purely additive Plan-Doc ✅ + commit-body disclosure ✅)

## Estimated Effort

- Phase 0: ~15 min (preflight, no code)
- Phase 1: ~3 hours (4 tables × 30-45 min each TDD-cycle)
- Phase 2: ~4 hours (4 layers + GDPR component + integration)
- Phase 3: ~4 hours (4 layers + token-flow + composition + bounce-webhook)
- Phase 4: ~2 hours (Admin-CLI + 2 frontend routes + seed-script)
- Phase 5: ~3 hours (form + API + Wait-Page + Result-Page)
- Phase 6: ~2 hours (Audience wrapper + integration + unsubscribe)
- Phase 7: ~3 hours (E2E + 2 Manual UATs)

**Total: ~21 hours of focused Bob-execution-work** spread across ~3-5 Bob-terminal-sessions (Bob's letter-d cadence: ~4-6 hours per session-shape).

## Out of Scope (B2 + Future Phases)

- ❌ Stripe Payment-Intent integration (→ B2)
- ❌ €1 / €3 Single-Shot checkout flow (→ B2)
- ❌ User accounts / Magic-link auth (→ Phase 3 per Design-Doc § 14.2)
- ❌ Subscription tier (→ Phase 3)
- ❌ BYOK tier (→ Phase 3)
- ❌ Browser-Fingerprint + Geo-Velocity Anti-Abuse (→ Phase 3 per Design-Doc § 7.5)
- ❌ Cross-Model + Strategy Benchmarks (→ Phase-2-A completion, separate work-class)
- ❌ Newsletter Engine + Weekly-Digest (→ Phase 3 per Design-Doc § 8.2)

---

**Plan-Doc completion:** 2026-05-20 letter-e MASCHIN-session. advisor()-pre-call (HARD R4) returned 5 catches all integrated (Split-B1+B2 + Examples-Gallery-folded-in-B1 + Fresh-files-supersede-stubs + Stripe-test-strategy-belongs-in-B2 + Phase-2-A-leftovers-out-of-scope) + 5 meta-issues integrated (GDPR-double-opt-in + Wait-Page-Conversion-Component + DB-Migrations-preconditions + Free-Shot-cost-bound + Kill-Switch-flow-non-trivial).
