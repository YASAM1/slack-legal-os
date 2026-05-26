CREATE TYPE "legal_os"."confirmation_status" AS ENUM('pending', 'approved', 'denied', 'timeout');--> statement-breakpoint
CREATE TABLE "legal_os"."confirmation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" "legal_os"."confirmation_status" DEFAULT 'pending' NOT NULL,
	"slack_channel" text,
	"slack_thread_ts" text,
	"slack_message_ts" text,
	"decided_by" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "confirmation_requests_status_idx" ON "legal_os"."confirmation_requests" USING btree ("status","posted_at");