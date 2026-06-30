import { NextResponse } from "next/server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const svgCaptcha = (await import("svg-captcha")).default;
  const captcha = svgCaptcha.create({
    size: 5,
    ignoreChars: '0o1i',
    noise: 2,
    color: true,
    background: '#f8f9fa'
  });

  // Create a hash of the text with a secret to prevent tampering
  const secret = process.env.JWT_SECRET || "default_fallback_secret_for_captcha";
  // The text is stored in lower case to make validation case-insensitive
  const hash = createHash("sha256").update(captcha.text.toLowerCase() + secret).digest("hex");

  const response = NextResponse.json({
    svg: captcha.data
  });

  // Set cookie with the hash, valid for 5 minutes
  response.cookies.set("captcha_token", hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/"
  });

  return response;
}
