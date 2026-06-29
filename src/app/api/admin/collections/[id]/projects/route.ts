import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectionProjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { projectId, sortOrder, notes } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const inserted = await db.insert(collectionProjects).values({
      collectionId: id,
      projectId,
      sortOrder: sortOrder || 0,
      notes: notes || null,
    }).returning();

    revalidatePath("/admin/collections");
    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    console.error("Error adding project to collection:", error);
    return NextResponse.json({ error: "Failed to add project" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    await db.delete(collectionProjects)
      .where(and(eq(collectionProjects.collectionId, id), eq(collectionProjects.projectId, projectId)));

    revalidatePath("/admin/collections");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing project:", error);
    return NextResponse.json({ error: "Failed to remove project" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { items } = await req.json(); 
    // items should be [{ id: "collection_project_id", sortOrder: number }]

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Items array is required" }, { status: 400 });
    }

    // Since SQLite/pg don't natively support easy bulk updates by varying values in a simple way 
    // without raw SQL CASE statements, we'll do sequential updates since the array is typically small.
    // Or we can do a transaction.
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx.update(collectionProjects)
          .set({ sortOrder: item.sortOrder })
          .where(and(eq(collectionProjects.id, item.id), eq(collectionProjects.collectionId, id)));
      }
    });

    revalidatePath("/admin/collections");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating sort order:", error);
    return NextResponse.json({ error: "Failed to update sort order" }, { status: 500 });
  }
}
