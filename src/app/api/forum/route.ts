import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectReviews, users, projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const feed = await db
      .select({
        reviewId: projectReviews.id,
        rating: projectReviews.rating,
        reviewText: projectReviews.reviewText,
        createdAt: projectReviews.createdAt,
        user: {
          username: users.username,
          role: users.role,
        },
        project: {
          id: projects.id,
          name: projects.name,
          fullName: projects.fullName,
          slug: projects.slug,
          source: projects.source,
          projectType: projects.projectType,
          description: projects.description,
          ownerAvatarUrl: projects.ownerAvatarUrl,
        },
      })
      .from(projectReviews)
      .innerJoin(users, eq(projectReviews.userId, users.id))
      .innerJoin(projects, eq(projectReviews.projectId, projects.id))
      .orderBy(desc(projectReviews.createdAt))
      .limit(30);

    return NextResponse.json(feed);
  } catch (error) {
    console.error("GET Forum feed error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
