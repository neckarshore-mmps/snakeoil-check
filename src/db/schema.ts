import {
  boolean,
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
