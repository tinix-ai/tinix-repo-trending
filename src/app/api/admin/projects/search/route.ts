import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { ilike, or, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const results = await db.select({
      id: projects.id,
      fullName: projects.fullName,
      description: projects.description,
      source: projects.source,
    })
    .from(projects)
    .where(
      or(
        ilike(projects.fullName, `%${q}%`),
        ilike(projects.description, `%${q}%`)
      )
    )
    .orderBy(desc(projects.stars))
    .limit(10);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error searching projects:", error);
    return NextResponse.json({ error: "Failed to search projects" }, { status: 500 });
  }
}
