import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectReviews, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";
import { containsBadWords } from "@/lib/bad-words";
import { cookies } from "next/headers";
import { createHash } from "crypto";

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
        status: projectReviews.status,
        user: {
          username: users.username,
          role: users.role,
        },
      })
      .from(projectReviews)
      .innerJoin(users, eq(projectReviews.userId, users.id))
      .where(
        and(
          eq(projectReviews.projectId, projectId),
          eq(projectReviews.status, "published")
        )
      )
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

    const { rating, reviewText, captchaText } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Điểm đánh giá phải từ 1 đến 5 sao" }, { status: 400 });
    }

    if (!captchaText) {
      return NextResponse.json({ error: "Vui lòng nhập mã xác nhận" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const captchaToken = cookieStore.get("captcha_token")?.value;

    if (!captchaToken) {
      return NextResponse.json({ error: "Mã xác nhận đã hết hạn, vui lòng tải lại" }, { status: 400 });
    }

    const secret = process.env.JWT_SECRET || "default_fallback_secret_for_captcha";
    const hash = createHash("sha256").update(captchaText.toLowerCase() + secret).digest("hex");

    if (hash !== captchaToken) {
      return NextResponse.json({ error: "Mã xác nhận không chính xác" }, { status: 400 });
    }

    // Check for bad words
    const isSpam = reviewText ? containsBadWords(reviewText) : false;
    const status = isSpam ? "pending" : "published";

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
          status,
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
          status,
        })
        .returning();
      result = inserted;
    }

    if (status === "pending") {
      return NextResponse.json({ 
        success: true, 
        review: result, 
        message: "Đánh giá của bạn đã được ghi nhận và đang chờ quản trị viên phê duyệt do chứa từ khóa nhạy cảm."
      });
    }

    return NextResponse.json({ success: true, review: result });
  } catch (error) {
    console.error("POST Review error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
