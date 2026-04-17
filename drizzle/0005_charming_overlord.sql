ALTER TABLE "answer_status" ADD COLUMN "stability_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "answer_status" ADD COLUMN "description" text;