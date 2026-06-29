import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null });
    }
    return NextResponse.json({
      authenticated: true,
      user: {
        userId: session.userId,
        username: session.username,
        role: session.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi" },
      { status: 500 }
    );
  }
}
