import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectReviews, users, projects } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending"; // 'pending' | 'published' | 'rejected'

    const reviews = await db
      .select({
        id: projectReviews.id,
        rating: projectReviews.rating,
        reviewText: projectReviews.reviewText,
        status: projectReviews.status,
        createdAt: projectReviews.createdAt,
        user: {
          username: users.username,
        },
        project: {
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
        }
      })
      .from(projectReviews)
      .innerJoin(users, eq(projectReviews.userId, users.id))
      .innerJoin(projects, eq(projectReviews.projectId, projects.id))
      .where(eq(projectReviews.status, status))
      .orderBy(desc(projectReviews.createdAt));

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("GET Admin Reviews error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id, status } = await request.json();

    if (!id || !['published', 'pending', 'rejected'].includes(status)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    await db
      .update(projectReviews)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(projectReviews.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Admin Reviews error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await db.delete(projectReviews).where(eq(projectReviews.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Admin Reviews error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
