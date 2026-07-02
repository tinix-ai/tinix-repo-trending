import { db } from "./index";
import { posts, users, projects } from "./schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";

// 1. Get published posts for the public feed
export async function getPublishedPosts(options?: {
  tag?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;

  let whereClause = eq(posts.status, "published");

  if (options?.projectId) {
    whereClause = and(whereClause, eq(posts.projectId, options.projectId)) as any;
  }

  // Handle filtering by tag if needed
  // Note: tags is a jsonb array of strings, so we query it using PostgreSQL jsonb containment: tags @> '["tag"]'
  if (options?.tag) {
    const jsonTag = JSON.stringify([options.tag]);
    whereClause = and(
      whereClause,
      sql`${posts.tags} @> ${jsonTag}::jsonb`
    ) as any;
  }

  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      summary: posts.summary,
      coverImage: posts.coverImage,
      createdAt: posts.createdAt,
      publishedAt: posts.publishedAt,
      views: posts.views,
      tags: posts.tags,
      author: {
        id: users.id,
        username: users.username,
      },
      project: {
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        ownerAvatarUrl: projects.ownerAvatarUrl,
        primaryLanguage: projects.primaryLanguage,
        stars: projects.stars,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(projects, eq(posts.projectId, projects.id))
    .where(whereClause)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);
}

// 2. Get single post by slug
export async function getPostBySlug(slug: string) {
  const result = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      content: posts.content,
      summary: posts.summary,
      coverImage: posts.coverImage,
      status: posts.status,
      createdAt: posts.createdAt,
      publishedAt: posts.publishedAt,
      views: posts.views,
      tags: posts.tags,
      seoTitle: posts.seoTitle,
      seoDescription: posts.seoDescription,
      author: {
        id: users.id,
        username: users.username,
      },
      project: {
        id: projects.id,
        name: projects.name,
        fullName: projects.fullName,
        slug: projects.slug,
        ownerAvatarUrl: projects.ownerAvatarUrl,
        primaryLanguage: projects.primaryLanguage,
        stars: projects.stars,
        description: projects.description,
        sourceUrl: projects.sourceUrl,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(projects, eq(posts.projectId, projects.id))
    .where(eq(posts.slug, slug))
    .limit(1);

  return result[0] || null;
}

// 3. Get single post by ID (for edit/verification)
export async function getPostById(id: string) {
  const result = await db
    .select()
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  return result[0] || null;
}

// 4. Get posts written by a specific user (for Profile)
export async function getUserPosts(userId: string) {
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      views: posts.views,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
      rejectionReason: posts.rejectionReason,
    })
    .from(posts)
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.createdAt));
}

// 5. Get pending posts for admin moderation
export async function getPendingPosts() {
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      createdAt: posts.createdAt,
      author: {
        username: users.username,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.status, "pending"))
    .orderBy(desc(posts.createdAt));
}

// 6. Get trending posts (most viewed)
export async function getTrendingPosts(limit = 5) {
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      coverImage: posts.coverImage,
      views: posts.views,
      publishedAt: posts.publishedAt,
      author: {
        username: users.username,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.views))
    .limit(limit);
}

// 7. Increment view count
export async function incrementPostViews(id: string) {
  await db
    .update(posts)
    .set({
      views: sql`${posts.views} + 1`,
    })
    .where(eq(posts.id, id));
}
