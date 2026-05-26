CREATE SCHEMA "legal_os";
--> statement-breakpoint
CREATE TYPE "legal_os"."capability_status" AS ENUM('draft', 'tested', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "legal_os"."kb_source" AS ENUM('curated', 'clio', 'web');--> statement-breakpoint
CREATE TYPE "legal_os"."run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "legal_os"."run_trigger" AS ENUM('agent', 'cron', 'dry_run', 'manual');--> statement-breakpoint
CREATE TABLE "legal_os"."agent_config" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"system_prompt" text NOT NULL,
	"model" text DEFAULT 'anthropic/claude-sonnet-4.6' NOT NULL,
	"temperature" integer DEFAULT 0 NOT NULL,
	"default_report_channel" text,
	"allowed_web_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"daily_token_budget" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_os"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_slack_user_id" text,
	"actor_name" text,
	"action" text NOT NULL,
	"resource" text,
	"payload" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_os"."capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"nl_spec" text NOT NULL,
	"generated_code" text NOT NULL,
	"primitive_tools_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "legal_os"."capability_status" DEFAULT 'draft' NOT NULL,
	"schedule" text,
	"next_run_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capabilities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "legal_os"."capability_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" uuid NOT NULL,
	"trigger" "legal_os"."run_trigger" NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"status" "legal_os"."run_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"slack_user_id" text
);
--> statement-breakpoint
CREATE TABLE "legal_os"."clio_oauth" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_os"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slack_channel" text NOT NULL,
	"slack_thread_ts" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_os"."kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "legal_os"."kb_source" NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_os"."capability_runs" ADD CONSTRAINT "capability_runs_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "legal_os"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "legal_os"."audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "legal_os"."audit_log" USING btree ("actor_slack_user_id");--> statement-breakpoint
CREATE INDEX "capability_runs_capability_idx" ON "legal_os"."capability_runs" USING btree ("capability_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_thread_uniq" ON "legal_os"."conversations" USING btree ("slack_channel","slack_thread_ts");--> statement-breakpoint
CREATE INDEX "kb_documents_embedding_idx" ON "legal_os"."kb_documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "kb_documents_source_external_idx" ON "legal_os"."kb_documents" USING btree ("source","external_id");