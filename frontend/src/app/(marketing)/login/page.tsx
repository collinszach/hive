// src/app/(marketing)/login/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => { if (r.ok) router.replace("/dashboard"); })
      .catch(() => {});
    fetch("/api/auth/setup-required")
      .then((r) => r.json())
      .then((d: { setup_required?: boolean }) => { if (d.setup_required) router.replace("/register"); })
      .catch(() => {});
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-8 relative overflow-hidden"
      style={{ background: "#07080F" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[480px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(245,185,66,0.07) 0%, transparent 70%)",
        }}
      />
      {/* Hex grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.02,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='52' viewBox='0 0 60 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.3V34.6L30 52L0 34.6V17.3L30 0Z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 52px",
        }}
      />

      <div className="w-full max-w-[320px] relative z-10">
        {/* Brand */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-5">
            <svg width="52" height="48" viewBox="0 0 57 50" fill="none">
              <polygon points="10,2 18,6.5 18,15.5 10,20 2,15.5 2,6.5" fill="#F5B942"/>
              <polygon points="10,18 18,22.5 18,31.5 10,36 2,31.5 2,22.5" fill="#F5B942"/>
              <polygon points="10,34 18,38.5 18,47.5 10,52 2,47.5 2,38.5" fill="#F5B942"/>
              <polygon points="28,18 36,22.5 36,31.5 28,36 20,31.5 20,22.5" fill="#F5B942"/>
              <polygon points="46,2 54,6.5 54,15.5 46,20 38,15.5 38,6.5" fill="#F5B942"/>
              <polygon points="46,18 54,22.5 54,31.5 46,36 38,31.5 38,22.5" fill="#F5B942"/>
              <polygon points="46,34 54,38.5 54,47.5 46,52 38,47.5 38,38.5" fill="#F5B942"/>
            </svg>
          </div>
          <p className="text-[28px] font-bold tracking-[0.2em]" style={{ color: "#F0F2F5" }}>
            HIVE
          </p>
          <p className="text-[10px] font-medium tracking-[0.2em] uppercase mt-1.5" style={{ color: "rgba(255,255,255,0.22)" }}>
            Personal Finance Intelligence
          </p>
        </div>

        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-[14px] font-medium transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.10)",
            color: "#EEEEF0",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.09)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.10)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </a>

        <div className="flex justify-center gap-6 mt-10">
          {[["Home", "/"], ["Privacy", "/privacy"]].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-[11px] transition-colors duration-150"
              style={{ color: "rgba(255,255,255,0.15)" }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
