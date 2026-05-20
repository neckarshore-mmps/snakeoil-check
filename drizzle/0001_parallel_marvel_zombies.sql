CREATE TYPE "public"."check_tier" AS ENUM('free-shot', 'standard', 'deep', 'example');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not-required', 'pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stake_indicator" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."tendency" AS ENUM('green', 'amber', 'red');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "check_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"criteria_scored" integer NOT NULL,
	"total_score" integer NOT NULL,
	"tendency" "tendency" NOT NULL,
	"criteria_scores" jsonb NOT NULL,
	"warning_truncated" boolean DEFAULT false NOT NULL,
	"raw_llm_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"url_normalized" text NOT NULL,
	"tier" "check_tier" NOT NULL,
	"stake_indicator" "stake_indicator",
	"deep_analysis_requested" boolean DEFAULT false NOT NULL,
	"payment_status" "payment_status" DEFAULT 'not-required' NOT NULL,
	"stripe_payment_intent_id" text,
	"payment_intent_amount_cents" integer,
	"scrape_status" "scrape_status" DEFAULT 'pending' NOT NULL,
	"scrape_html_blob_url" text,
	"workflow_status" "workflow_status" DEFAULT 'pending' NOT NULL,
	"workflow_error" text,
	"model_provider" text,
	"model_id" text,
	"token_budget_used_input" integer,
	"token_budget_used_output" integer,
	"llm_cost_eur_cents" integer,
	"is_curated_example" boolean DEFAULT false NOT NULL,
	"example_slug" text,
	"ip_hash" text,
	"cookie_session" text,
	"email_subscriber_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "checks_result_token_unique" UNIQUE("result_token")
);
--> statement-breakpoint
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE cascade ON UPDATE no action;