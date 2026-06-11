ALTER TABLE "rankings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "rankings" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "readme" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE INDEX "project_snapshot_date_idx" ON "project_snapshots" USING btree ("project_id","snapshot_date");