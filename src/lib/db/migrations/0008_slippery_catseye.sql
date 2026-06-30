CREATE TABLE "project_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"achievement_type" text NOT NULL,
	"rank" integer NOT NULL,
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"achieved_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_achievements_unique" UNIQUE("project_id","achievement_type","scope","period","achieved_at")
);
--> statement-breakpoint
ALTER TABLE "project_achievements" ADD CONSTRAINT "project_achievements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_achievements_project_idx" ON "project_achievements" USING btree ("project_id");