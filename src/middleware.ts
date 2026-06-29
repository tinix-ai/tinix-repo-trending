import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathParts = pathname.split("/");
  
  // Check if request is accessing admin paths
  const isAdminRoute = pathParts.includes("admin");

  if (isAdminRoute) {
    const token = request.cookies.get("session")?.value;
    const session = await verifyToken(token);

    // If no session or user is not an admin, redirect to login
    if (!session || session.role !== "admin") {
      const locale = pathParts[1] && routing.locales.includes(pathParts[1] as any) ? pathParts[1] : "vi";
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except API routes, static files, and standard next assets
  matcher: ["/", "/(vi|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
