import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPendingPosts } from "@/lib/db/blog-queries";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const pendingPosts = await getPendingPosts();
    return NextResponse.json({ posts: pendingPosts });
  } catch (error) {
    console.error("Error fetching pending blog posts:", error);
    return NextResponse.json({ error: "Failed to fetch pending blog posts" }, { status: 500 });
  }
}
