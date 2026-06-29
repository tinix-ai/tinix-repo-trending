import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateSalt, hashPassword, setSessionCookie } from "@/lib/auth";
import { count, eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password || username.length < 3 || password.length < 6) {
      return NextResponse.json(
        { error: "Tên đăng nhập tối thiểu 3 ký tự, mật khẩu tối thiểu 6 ký tự" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase().trim();

    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, normalizedUsername))
      .limit(1);

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Tên đăng nhập đã tồn tại" },
        { status: 409 }
      );
    }

    // Determine role (first user becomes admin)
    const userCountResult = await db.select({ value: count() }).from(users);
    const userCount = Number(userCountResult[0]?.value ?? 0);
    const role = userCount === 0 ? "admin" : "user";

    // Hash password
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Insert user
    const [newUser] = await db
      .insert(users)
      .values({
        username: normalizedUsername,
        passwordHash,
        salt,
        role,
      })
      .returning();

    // Set HttpOnly session cookie
    await setSessionCookie({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ" },
      { status: 500 }
    );
  }
}
