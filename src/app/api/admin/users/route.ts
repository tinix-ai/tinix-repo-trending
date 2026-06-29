import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET all users
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// UPDATE user role
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, role } = await request.json();

    if (!id || !role || !["admin", "user"].includes(role)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Don't allow an admin to demote themselves
    if (id === session.userId && role === "user") {
      return NextResponse.json({ error: "You cannot demote yourself" }, { status: 400 });
    }

    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user role:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE a user
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Don't allow an admin to delete themselves
    if (id === session.userId) {
      return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
    }

    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
