ALTER TABLE "answer_status" DROP CONSTRAINT "answer_status_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "tag" DROP CONSTRAINT "tag_project_id_project_id_fk";
--> statement-breakpoint
DROP INDEX "answer_status_project_code_key";--> statement-breakpoint
DROP INDEX "tag_project_code_key";--> statement-breakpoint
CREATE UNIQUE INDEX "answer_status_code_key" ON "answer_status" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_code_key" ON "tag" USING btree ("code");--> statement-breakpoint
ALTER TABLE "answer_status" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "tag" DROP COLUMN "project_id";