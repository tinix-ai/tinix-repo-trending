import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectVotes } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, count } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await getSession();

    // Fetch total likes
    const likesResult = await db
      .select({ value: count() })
      .from(projectVotes)
      .where(and(eq(projectVotes.projectId, projectId), eq(projectVotes.voteType, "like")));
    const likes = Number(likesResult[0]?.value ?? 0);

    // Fetch total dislikes
    const dislikesResult = await db
      .select({ value: count() })
      .from(projectVotes)
      .where(and(eq(projectVotes.projectId, projectId), eq(projectVotes.voteType, "dislike")));
    const dislikes = Number(dislikesResult[0]?.value ?? 0);

    // Check if current user voted
    let userVote = null;
    if (session) {
      const vote = await db
        .select()
        .from(projectVotes)
        .where(and(eq(projectVotes.projectId, projectId), eq(projectVotes.userId, session.userId)))
        .limit(1);
      if (vote.length > 0) {
        userVote = vote[0].voteType;
      }
    }

    return NextResponse.json({ likes, dislikes, userVote });
  } catch (error) {
    console.error("GET Vote error:", error);
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

    const { voteType } = await request.json();

    if (voteType !== "like" && voteType !== "dislike") {
      return NextResponse.json({ error: "Loại vote không hợp lệ" }, { status: 400 });
    }

    // Check if user already voted
    const existing = await db
      .select()
      .from(projectVotes)
      .where(and(eq(projectVotes.projectId, projectId), eq(projectVotes.userId, session.userId)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].voteType === voteType) {
        // Toggle off if clicking the same vote type again
        await db.delete(projectVotes).where(eq(projectVotes.id, existing[0].id));
        return NextResponse.json({ success: true, action: "removed" });
      } else {
        // Switch vote type
        await db
          .update(projectVotes)
          .set({ voteType })
          .where(eq(projectVotes.id, existing[0].id));
        return NextResponse.json({ success: true, action: "updated" });
      }
    } else {
      // New vote
      await db.insert(projectVotes).values({
        projectId,
        userId: session.userId,
        voteType,
      });
      return NextResponse.json({ success: true, action: "added" });
    }
  } catch (error) {
    console.error("POST Vote error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
