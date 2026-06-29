import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionProjects, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Fetch collection
    const collection = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
    if (collection.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Fetch associated projects
    const assocProjects = await db
      .select({
        id: collectionProjects.id,
        projectId: projects.id,
        fullName: projects.fullName,
        description: projects.description,
        source: projects.source,
        sortOrder: collectionProjects.sortOrder,
        notes: collectionProjects.notes,
      })
      .from(collectionProjects)
      .innerJoin(projects, eq(collectionProjects.projectId, projects.id))
      .where(eq(collectionProjects.collectionId, id))
      .orderBy(collectionProjects.sortOrder);

    return NextResponse.json({
      collection: collection[0],
      projects: assocProjects,
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json({ error: "Failed to fetch collection" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, slug, description } = await req.json();

    if (!title || !slug) {
      return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
    }

    const updated = await db.update(collections)
      .set({ title, slug, description, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    revalidatePath("/admin/collections");
    revalidatePath(`/${slug}`);
    
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = await db.delete(collections).where(eq(collections.id, id)).returning();
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    revalidatePath("/admin/collections");
    revalidatePath(`/${deleted[0].slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
