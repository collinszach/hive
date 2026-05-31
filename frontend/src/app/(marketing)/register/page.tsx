// src/app/(marketing)/register/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Star, Zap } from "lucide-react";
import HiveHex from "../_components/HiveHex";
import { isNative, startGoogleSignIn } from "@/lib/native-auth";

// ── Feature bullet ────────────────────────────────────────────────────────────

function FeatureBullet({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-9 h-9 rounded-xl bg-honey-faint border border-border-honey flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-[14px] font-semibold text-ink-primary leading-snug">{title}</p>
        <p className="text-[13px] text-ink-tertiary mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => { if (r.ok) router.replace("/dashboard"); else setChecking(false); })
      .catch(() => setChecking(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-base flex overflow-hidden">

      {/* ── LEFT — branding panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden px-14 py-12">
        {/* Glow blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 10%, rgba(245,185,66,0.12) 0%, transparent 65%),
              radial-gradient(ellipse 60% 50% at 80% 80%, rgba(245,185,66,0.06) 0%, transparent 60%)
            `,
          }}
        />
        {/* Hex grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='52' viewBox='0 0 60 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.3V34.6L30 52L0 34.6V17.3L30 0Z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: "60px 52px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <svg width="38" height="34" viewBox="0 0 57 50" fill="none"><polygon points="10,2 18,6.5 18,15.5 10,20 2,15.5 2,6.5" fill="#F5B942"/><polygon points="10,18 18,22.5 18,31.5 10,36 2,31.5 2,22.5" fill="#F5B942"/><polygon points="10,34 18,38.5 18,47.5 10,52 2,47.5 2,38.5" fill="#F5B942"/><polygon points="28,18 36,22.5 36,31.5 28,36 20,31.5 20,22.5" fill="#F5B942"/><polygon points="46,2 54,6.5 54,15.5 46,20 38,15.5 38,6.5" fill="#F5B942"/><polygon points="46,18 54,22.5 54,31.5 46,36 38,31.5 38,22.5" fill="#F5B942"/><polygon points="46,34 54,38.5 54,47.5 46,52 38,47.5 38,38.5" fill="#F5B942"/></svg>
          <span className="text-[17px] font-bold tracking-[-0.01em] text-ink-primary">HIVE</span>
        </div>

        {/* Center hero */}
        <div className="relative z-10 space-y-10 -mt-8">
          <div>
            <h1 className="text-[40px] font-bold tracking-[-0.03em] text-ink-primary leading-[1.08]">
              Your money,{" "}
              <span className="text-honey">your data,</span>
              <br />
              your rules.
            </h1>
            <p className="mt-4 text-[15px] text-ink-secondary leading-relaxed max-w-[360px]">
              Automatic bank sync, AI categorization, rewards optimization, and Claude-powered
              answers — all in one place.
            </p>
          </div>

          <div className="space-y-5">
            <FeatureBullet
              icon={<Zap className="w-4 h-4 text-honey" />}
              title="Auto sync + AI categorization"
              desc="Every transaction tagged automatically via Plaid + Claude."
            />
            <FeatureBullet
              icon={<Star className="w-4 h-4 text-honey" />}
              title="Maximize your rewards"
              desc="Always know which card earns the most on every purchase."
            />
            <FeatureBullet
              icon={<CreditCard className="w-4 h-4 text-honey" />}
              title="Open source — self-host or managed"
              desc="Run it on your own server free, or let us handle everything."
            />
          </div>
        </div>

        {/* Bottom */}
        <p className="relative z-10 text-[11px] text-ink-ghost tracking-wide">
          SELF-HOSTED · PRIVATE BY DESIGN · OPEN SOURCE
        </p>
      </div>

      {/* ── RIGHT — form panel ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-12 relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 0%, rgba(245,185,66,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <svg width="48" height="44" viewBox="0 0 57 50" fill="none"><polygon points="10,2 18,6.5 18,15.5 10,20 2,15.5 2,6.5" fill="#F5B942"/><polygon points="10,18 18,22.5 18,31.5 10,36 2,31.5 2,22.5" fill="#F5B942"/><polygon points="10,34 18,38.5 18,47.5 10,52 2,47.5 2,38.5" fill="#F5B942"/><polygon points="28,18 36,22.5 36,31.5 28,36 20,31.5 20,22.5" fill="#F5B942"/><polygon points="46,2 54,6.5 54,15.5 46,20 38,15.5 38,6.5" fill="#F5B942"/><polygon points="46,18 54,22.5 54,31.5 46,36 38,31.5 38,22.5" fill="#F5B942"/><polygon points="46,34 54,38.5 54,47.5 46,52 38,47.5 38,38.5" fill="#F5B942"/></svg>
            <h1 className="text-2xl font-bold text-ink-primary mt-3">HIVE</h1>
            <p className="text-[13px] text-ink-tertiary mt-1">Your money, your data, your rules.</p>
          </div>

          {/* Heading */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink-primary">
              Create your account
            </h2>
            <p className="text-[14px] text-ink-tertiary mt-1.5">
              Start tracking your finances in minutes.
            </p>
          </div>
          <div className="mb-8 lg:hidden">
            <h2 className="text-[20px] font-bold text-ink-primary text-center">Create your account</h2>
            <p className="text-[13px] text-ink-tertiary mt-1 text-center">Sign in with Google to get started</p>
          </div>

          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-[14px] font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1.5px solid rgba(255,255,255,0.08)",
              color: "#EEEEF0",
            }}
            onClick={(e) => {
              if (isNative()) {
                e.preventDefault();
                void startGoogleSignIn();
              }
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
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
        </div>
      </div>
    </div>
  );
}
