CREATE TABLE "project_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stars" integer DEFAULT 0,
	"forks" integer DEFAULT 0,
	"open_issues" integer DEFAULT 0,
	"watchers" integer DEFAULT 0,
	"contributors_count" integer DEFAULT 0,
	"downloads" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"snapshot_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"ai_summary" text,
	"homepage_url" text,
	"source_url" text NOT NULL,
	"primary_language" text,
	"license" text,
	"owner_name" text NOT NULL,
	"owner_avatar_url" text,
	"owner_type" text,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"extra_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"source_created_at" timestamp,
	"last_crawled_at" timestamp,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"period" text NOT NULL,
	"ranking_date" date NOT NULL,
	"rank" integer NOT NULL,
	"score" double precision NOT NULL,
	"stars_gained" integer DEFAULT 0,
	"forks_gained" integer DEFAULT 0,
	"downloads_gained" integer DEFAULT 0,
	"velocity_score" double precision DEFAULT 0,
	"momentum_score" double precision DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;