import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function GET(req: NextRequest) {
  try {
    const allCollections = await db.select().from(collections).orderBy(desc(collections.createdAt));
    return NextResponse.json(allCollections);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, slug, description } = await req.json();
    if (!title || !slug) {
      return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
    }

    // Check if slug exists
    const existing = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const newCollection = await db.insert(collections).values({
      title,
      slug,
      description: description || null,
    }).returning();

    revalidatePath("/admin/collections");
    revalidatePath(`/${slug}`);
    
    return NextResponse.json(newCollection[0], { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
