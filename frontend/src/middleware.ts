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

  // Presence check only. The backend is the single source of truth for token
  // validity — it verifies the JWT signature/expiry on every /api/auth/me and
  // protected API call. Re-verifying here required the frontend to hold a copy
  // of SECRET_KEY; any drift between the two silently rejected valid sessions
  // and logged the user out on every navigation. A bad/expired cookie that
  // slips past this check is caught by the backend (401 → client redirects to
  // /login), so nothing is exposed.
  const token = request.cookies.get("hive_auth")?.value;
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
