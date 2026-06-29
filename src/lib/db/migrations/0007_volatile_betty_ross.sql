CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"keywords" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "github_users" (
	"username" text PRIMARY KEY NOT NULL,
	"location" text,
	"country_code" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source" text NOT NULL,
	"author" text NOT NULL,
	"author_avatar_url" text,
	"content" text NOT NULL,
	"url" text NOT NULL,
	"score" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"mentioned_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_mentions_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "project_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"pre_analysis_data" jsonb DEFAULT '{}'::jsonb,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"submitter_id" uuid
);
--> statement-breakpoint
CREATE TABLE "project_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_votes_user_project_uniq" UNIQUE("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "share_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_code" text NOT NULL,
	"clicked_at" timestamp DEFAULT now() NOT NULL,
	"referrer" text,
	"user_agent" text,
	"ip_hash" text,
	"country" text,
	"device_type" text
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text,
	"utm_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "share_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"salt" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "readme_sha" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stars" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "forks" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "watchers" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "open_issues" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "downloads" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "likes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contributors_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "etag" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "views" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "submitter_id" uuid;--> statement-breakpoint
ALTER TABLE "collection_projects" ADD CONSTRAINT "collection_projects_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_projects" ADD CONSTRAINT "collection_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_mentions" ADD CONSTRAINT "project_mentions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_votes" ADD CONSTRAINT "project_votes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_votes" ADD CONSTRAINT "project_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_mentions_project_idx" ON "project_mentions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_mentions_source_idx" ON "project_mentions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "project_mentions_mentioned_at_idx" ON "project_mentions" USING btree ("mentioned_at");--> statement-breakpoint
CREATE INDEX "project_reviews_project_idx" ON "project_reviews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_reviews_user_idx" ON "project_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_reviews_status_idx" ON "project_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_submissions_status_idx" ON "project_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_submissions_submitted_at_idx" ON "project_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "project_submissions_submitter_idx" ON "project_submissions" USING btree ("submitter_id");--> statement-breakpoint
CREATE INDEX "project_votes_project_idx" ON "project_votes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_votes_user_idx" ON "project_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "share_events_code_idx" ON "share_events" USING btree ("link_code");--> statement-breakpoint
CREATE INDEX "share_events_clicked_at_idx" ON "share_events" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "share_links_code_idx" ON "share_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "share_links_project_idx" ON "share_links" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_snapshot_date_only_idx" ON "project_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "projects_submitter_idx" ON "projects" USING btree ("submitter_id");