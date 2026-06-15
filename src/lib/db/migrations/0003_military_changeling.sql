CREATE TABLE "project_trends" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"daily_stars" integer DEFAULT 0,
	"weekly_stars" integer DEFAULT 0,
	"monthly_stars" integer DEFAULT 0,
	"daily_downloads" integer DEFAULT 0,
	"weekly_downloads" integer DEFAULT 0,
	"monthly_downloads" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "crawl_interval" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "next_crawl_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "project_trends" ADD CONSTRAINT "project_trends_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;