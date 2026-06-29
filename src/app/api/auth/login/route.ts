import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase().trim();

    // Fetch user
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, normalizedUsername))
      .limit(1);

    const user = foundUsers[0];

    if (!user) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    // Verify password hash
    const computedHash = await hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    // Set HttpOnly session cookie
    await setSessionCookie({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ" },
      { status: 500 }
    );
  }
}
