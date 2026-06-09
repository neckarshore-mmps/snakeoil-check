import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Users (Phase-1) ──────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailHash: text('email_hash').notNull().unique(),
  emailPlain: text('email_plain').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ── Enums (Phase-2-A) ────────────────────────────────────────────────────────

// PHASE-3 EXTENSION POINT (per Dr. Sommer F-NEW-2 2026-05-20-d):
// When sub-tier launches, extend this enum with 'sub-no-byok' + 'sub-byok'
// and create migration. See src/lib/router/types.ts RouteContext.tier comment.
export const checkTierEnum = pgEnum('check_tier', ['free-shot', 'standard', 'deep', 'example']);

export const stakeIndicatorEnum = pgEnum('stake_indicator', ['low', 'medium', 'high']);

export const paymentStatusEnum = pgEnum('payment_status', [
  'not-required',
  'pending',
  'paid',
  'failed',
  'refunded',
]);

export const scrapeStatusEnum = pgEnum('scrape_status', ['pending', 'done', 'failed']);

export const workflowStatusEnum = pgEnum('workflow_status', [
  'pending',
  'running',
  'done',
  'failed',
]);

export const tendencyEnum = pgEnum('tendency', ['green', 'amber', 'red']);

// ── Checks (Phase-2-A) ───────────────────────────────────────────────────────

export const checks = pgTable('checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  resultToken: uuid('result_token').notNull().unique().defaultRandom(),
  url: text('url').notNull(),
  urlNormalized: text('url_normalized').notNull(),
  tier: checkTierEnum('tier').notNull(),
  stakeIndicator: stakeIndicatorEnum('stake_indicator'),
  deepAnalysisRequested: boolean('deep_analysis_requested').notNull().default(false),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('not-required'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paymentIntentAmountCents: integer('payment_intent_amount_cents'),
  scrapeStatus: scrapeStatusEnum('scrape_status').notNull().default('pending'),
  scrapeHtmlBlobUrl: text('scrape_html_blob_url'),
  workflowStatus: workflowStatusEnum('workflow_status').notNull().default('pending'),
  workflowError: text('workflow_error'),
  modelProvider: text('model_provider'),
  modelId: text('model_id'),
  tokenBudgetUsedInput: integer('token_budget_used_input'),
  tokenBudgetUsedOutput: integer('token_budget_used_output'),
  llmCostEurCents: integer('llm_cost_eur_cents'),
  isCuratedExample: boolean('is_curated_example').notNull().default(false),
  exampleSlug: text('example_slug'),
  ipHash: text('ip_hash'),
  cookieSession: text('cookie_session'),
  emailSubscriberId: uuid('email_subscriber_id'), // FK populated Phase-2-B
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export type Check = typeof checks.$inferSelect;
export type NewCheck = typeof checks.$inferInsert;

// ── Check Results (Phase-2-A) ────────────────────────────────────────────────

export const checkResults = pgTable('check_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkId: uuid('check_id')
    .notNull()
    .references(() => checks.id, { onDelete: 'cascade' }),
  criteriaScored: integer('criteria_scored').notNull(),
  totalScore: integer('total_score').notNull(),
  tendency: tendencyEnum('tendency').notNull(),
  criteriaScores: jsonb('criteria_scores').notNull(), // [{criterion_id, raw_score, rationale, evidence_quote}]
  warningTruncated: boolean('warning_truncated').notNull().default(false),
  rawLlmResponse: jsonb('raw_llm_response'), // debug, purgeable
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CheckResult = typeof checkResults.$inferSelect;
export type NewCheckResult = typeof checkResults.$inferInsert;

// ── Enums (B1 Phase 1 — Free-Shot Funnel) ────────────────────────────────────

export const emailVerificationStatusEnum = pgEnum('email_verification_status', [
  'pending',
  'confirmed',
  'bounced',
  'expired',
]);

export const rateLimitKeyTypeEnum = pgEnum('rate_limit_key_type', ['ip', 'email', 'url']);

// ── Email Verifications (B1 Phase 1) ─────────────────────────────────────────
// Token-based email-confirm + bounce-tracking. email_hash + token_hash are
// hashed at rest (no plaintext PII here — plaintext lives only in users.emailPlain,
// guarded by the GDPR delete-endpoint, phase-7-hardening #13).

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailHash: text('email_hash').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    status: emailVerificationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    bouncedAt: timestamp('bounced_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('email_verifications_email_hash_idx').on(table.emailHash)],
);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;

// ── Email Subscribers (B1 Phase 1) ───────────────────────────────────────────
// Resend-Audience list membership + GDPR opt-in flag. removed_at = soft-delete
// (unsubscribe) so opt-out history survives for compliance.

export const emailSubscribers = pgTable(
  'email_subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailHash: text('email_hash').notNull(),
    audienceTag: text('audience_tag').notNull(),
    gdprMarketingOptIn: boolean('gdpr_marketing_opt_in').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [index('email_subscribers_email_hash_idx').on(table.emailHash)],
);

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type NewEmailSubscriber = typeof emailSubscribers.$inferInsert;

// ── Rate Limits (B1 Phase 1) ─────────────────────────────────────────────────
// Composite IP/Email/URL sliding-window storage for the anti-abuse pipeline.

export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: text('key_hash').notNull(),
    keyType: rateLimitKeyTypeEnum('key_type').notNull(),
    count: integer('count').notNull().default(0),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limits_key_hash_idx').on(table.keyHash)],
);

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;

// ── Curated Examples (B1 Phase 1) ────────────────────────────────────────────
// Tier-0 Examples Gallery data. url + slug unique (already indexed via unique).

export const curatedExamples = pgTable('curated_examples', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull().unique(),
  slug: text('slug').notNull().unique(),
  scoringResultJson: jsonb('scoring_result_json').notNull(),
  curatorNote: text('curator_note'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  lastRerunAt: timestamp('last_rerun_at', { withTimezone: true }),
});

export type CuratedExample = typeof curatedExamples.$inferSelect;
export type NewCuratedExample = typeof curatedExamples.$inferInsert;
