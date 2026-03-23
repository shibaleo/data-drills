CREATE TABLE "review_tag" (
	"review_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "review_tag_review_id_tag_id_pk" PRIMARY KEY("review_id","tag_id")
);
--> statement-breakpoint
DROP INDEX "problem_project_code_key";--> statement-breakpoint
ALTER TABLE "answer_status" ADD COLUMN "point" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_tag" ADD CONSTRAINT "review_tag_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tag" ADD CONSTRAINT "review_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "problem_project_code_key" ON "problem" USING btree ("project_id","code","subject_id","level_id");