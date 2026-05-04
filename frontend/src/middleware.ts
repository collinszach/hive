import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/register", "/pricing", "/privacy"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths, API calls, and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = request.cookies.get("saplyn_auth");
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
