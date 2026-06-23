import { pgTable, text, timestamp, integer, uuid, jsonb, date, index, customType } from "drizzle-orm/pg-core";
import * as zlib from "zlib";

export const bytea = customType<{ data: Buffer | string; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer | string) {
    if (typeof value === "string") {
      return zlib.gzipSync(Buffer.from(value, "utf-8"));
    }
    return value;
  },
  fromDriver(value: unknown) {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    return Buffer.from(value as string);
  },
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(), // 'github' | 'huggingface' | 'paperwithcode'
  projectType: text("project_type").notNull().default('repository'), // 'repository' | 'model' | 'dataset'
  sourceId: text("source_id").notNull(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description"),
  readme: bytea("readme"), // stored as compressed gzip bytea binary
  aiSummary: text("ai_summary"),
  homepageUrl: text("homepage_url"),
  sourceUrl: text("source_url").notNull(),
  primaryLanguage: text("primary_language"),
  license: text("license"),
  ownerName: text("owner_name").notNull(),
  ownerAvatarUrl: text("owner_avatar_url"),
  ownerType: text("owner_type"), // 'user' | 'org'
  topics: jsonb("topics").default([]),
  categories: jsonb("categories").default([]),
  extraMetadata: jsonb("extra_metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  sourceCreatedAt: timestamp("source_created_at"),
  sourceUpdatedAt: timestamp("source_updated_at"),
  lastCrawledAt: timestamp("last_crawled_at"),
  crawlInterval: integer("crawl_interval").default(1),
  nextCrawlAt: timestamp("next_crawl_at").defaultNow(),
}, (table) => [
  index("projects_next_crawl_idx").on(table.nextCrawlAt)
]);

export const projectSnapshots = pgTable("project_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  stars: integer("stars").default(0),
  forks: integer("forks").default(0),
  openIssues: integer("open_issues").default(0),
  watchers: integer("watchers").default(0),
  contributorsCount: integer("contributors_count").default(0),
  downloads: integer("downloads").default(0), // for HF
  likes: integer("likes").default(0), // for HF
  snapshotDate: date("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("project_snapshot_date_idx").on(table.projectId, table.snapshotDate)
]);

export const projectTrends = pgTable("project_trends", {
  projectId: uuid("project_id").references(() => projects.id).primaryKey(),
  dailyStars: integer("daily_stars").default(0),
  weeklyStars: integer("weekly_stars").default(0),
  monthlyStars: integer("monthly_stars").default(0),
  dailyDownloads: integer("daily_downloads").default(0),
  weeklyDownloads: integer("weekly_downloads").default(0),
  monthlyDownloads: integer("monthly_downloads").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(), // ID matches category name (e.g., "LLM")
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  keywords: jsonb("keywords").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMentions = pgTable("project_mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  source: text("source").notNull(), // 'reddit' | 'x' | 'hacker_news'
  author: text("author").notNull(),
  authorAvatarUrl: text("author_avatar_url"),
  content: text("content").notNull(),
  url: text("url").notNull().unique(),
  score: integer("score").default(0),
  commentsCount: integer("comments_count").default(0),
  mentionedAt: timestamp("mentioned_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("project_mentions_project_idx").on(table.projectId),
  index("project_mentions_source_idx").on(table.source),
  index("project_mentions_mentioned_at_idx").on(table.mentionedAt),
]);
