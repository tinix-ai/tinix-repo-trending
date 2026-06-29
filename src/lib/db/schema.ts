import { pgTable, text, timestamp, integer, uuid, jsonb, date, index, customType, unique } from "drizzle-orm/pg-core";
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
  readmeSha: text("readme_sha"),
  aiSummary: text("ai_summary"),
  homepageUrl: text("homepage_url"),
  sourceUrl: text("source_url").notNull(),
  primaryLanguage: text("primary_language"),
  license: text("license"),
  ownerName: text("owner_name").notNull(),
  ownerAvatarUrl: text("owner_avatar_url"),
  ownerType: text("owner_type"), // 'user' | 'org'
  topics: jsonb("topics").$type<string[]>().default([]),
  categories: jsonb("categories").$type<string[]>().default([]),
  stars: integer("stars").default(0),
  forks: integer("forks").default(0),
  watchers: integer("watchers").default(0),
  openIssues: integer("open_issues").default(0),
  downloads: integer("downloads").default(0),
  likes: integer("likes").default(0),
  contributorsCount: integer("contributors_count").default(0),
  extraMetadata: jsonb("extra_metadata").default({}),
  location: text("location"),
  countryCode: text("country_code"),
  etag: text("etag"),
  views: integer("views").default(0),
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
  index("project_snapshot_date_idx").on(table.projectId, table.snapshotDate),
  index("project_snapshot_date_only_idx").on(table.snapshotDate)
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

export const githubUsers = pgTable("github_users", {
  username: text("username").primaryKey(),
  location: text("location"),
  countryCode: text("country_code"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const collectionProjects = pgTable("collection_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "cascade" }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: text("title"),
  utmSource: text("utm_source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("share_links_code_idx").on(table.code),
  index("share_links_project_idx").on(table.projectId),
]);

export const shareEvents = pgTable("share_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkCode: text("link_code").notNull(),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  country: text("country"),
  deviceType: text("device_type"),
}, (table) => [
  index("share_events_code_idx").on(table.linkCode),
  index("share_events_clicked_at_idx").on(table.clickedAt),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectReviews = pgTable("project_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  rating: integer("rating").notNull(), // 1 to 5
  reviewText: text("review_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("project_reviews_project_idx").on(table.projectId),
  index("project_reviews_user_idx").on(table.userId),
]);

export const projectVotes = pgTable("project_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  voteType: text("vote_type").notNull(), // 'like' | 'dislike'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("project_votes_project_idx").on(table.projectId),
  index("project_votes_user_idx").on(table.userId),
  unique("project_votes_user_project_uq").on(table.projectId, table.userId)
]);



