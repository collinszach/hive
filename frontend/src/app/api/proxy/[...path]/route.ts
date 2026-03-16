/**
 * API proxy — validates NextAuth session then forwards to FastAPI with the
 * internal service token. The browser never sees INTERNAL_API_TOKEN.
 *
 * All "use client" components call /api/proxy/* instead of FastAPI directly.
 * Server Components can call FastAPI directly using the server-side api client.
 */
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  // Verify the caller has a valid session
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const path = params.path.join("/");
  const search = req.nextUrl.search;
  const upstreamUrl = `${BACKEND_URL}/api/${path}${search}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${INTERNAL_API_TOKEN}`,
    "Content-Type": req.headers.get("content-type") ?? "application/json",
  };

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.text()
    : undefined;

  const upstreamRes = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  const data = await upstreamRes.text();
  return new NextResponse(data, {
    status: upstreamRes.status,
    headers: { "Content-Type": upstreamRes.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
