import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectReviews, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const reviews = await db
      .select({
        id: projectReviews.id,
        rating: projectReviews.rating,
        reviewText: projectReviews.reviewText,
        createdAt: projectReviews.createdAt,
        user: {
          username: users.username,
          role: users.role,
        },
      })
      .from(projectReviews)
      .innerJoin(users, eq(projectReviews.userId, users.id))
      .where(eq(projectReviews.projectId, projectId))
      .orderBy(desc(projectReviews.createdAt));

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("GET Reviews error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
    }

    const { rating, reviewText } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Điểm đánh giá phải từ 1 đến 5 sao" }, { status: 400 });
    }

    // Check if user already reviewed
    const existing = await db
      .select()
      .from(projectReviews)
      .where(
        and(
          eq(projectReviews.projectId, projectId),
          eq(projectReviews.userId, session.userId)
        )
      )
      .limit(1);

    let result;
    if (existing.length > 0) {
      // Update
      const [updated] = await db
        .update(projectReviews)
        .set({
          rating,
          reviewText: reviewText || "",
          updatedAt: new Date(),
        })
        .where(eq(projectReviews.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      // Insert
      const [inserted] = await db
        .insert(projectReviews)
        .values({
          projectId,
          userId: session.userId,
          rating,
          reviewText: reviewText || "",
        })
        .returning();
      result = inserted;
    }

    return NextResponse.json({ success: true, review: result });
  } catch (error) {
    console.error("POST Review error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
