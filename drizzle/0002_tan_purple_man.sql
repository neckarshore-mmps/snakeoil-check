CREATE TYPE "public"."email_verification_status" AS ENUM('pending', 'confirmed', 'bounced', 'expired');--> statement-breakpoint
CREATE TYPE "public"."rate_limit_key_type" AS ENUM('ip', 'email', 'url');--> statement-breakpoint
CREATE TABLE "curated_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"slug" text NOT NULL,
	"scoring_result_json" jsonb NOT NULL,
	"curator_note" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_rerun_at" timestamp with time zone,
	CONSTRAINT "curated_examples_url_unique" UNIQUE("url"),
	CONSTRAINT "curated_examples_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"audience_tag" text NOT NULL,
	"gdpr_marketing_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "email_verification_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_verifications_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"key_type" "rate_limit_key_type" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_subscribers_email_hash_idx" ON "email_subscribers" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "email_verifications_email_hash_idx" ON "email_verifications" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "rate_limits_key_hash_idx" ON "rate_limits" USING btree ("key_hash");