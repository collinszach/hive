"use client";

// Auth tokens are now stored in httpOnly cookies set by the backend.
// JS cannot read them directly — the browser sends them automatically.
// These helpers exist for backward compatibility only.

export function getToken(): string | null {
  // Cannot access httpOnly cookie from JS — return a sentinel to indicate
  // "might be authenticated" (the actual check is /api/auth/me)
  return typeof window !== "undefined" ? "cookie" : null;
}

export function setToken(_token: string): void {
  // No-op: cookie is set by the backend on login response
}

export function clearToken(): void {
  // No-op: cookie is cleared by calling POST /api/auth/logout
}

export function authHeaders(): HeadersInit {
  // No Authorization header needed — cookie is sent automatically
  return {};
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { ...init, credentials: "include" });
  if (res.status === 401) {
    window.location.href = "/login";
  }
  return res;
}
