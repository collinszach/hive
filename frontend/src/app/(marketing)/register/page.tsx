// src/app/(marketing)/register/page.tsx
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock, Eye, EyeOff, AlertCircle, CheckCircle2,
  CreditCard, Star, Zap, ArrowRight,
} from "lucide-react";
import HiveHex from "../_components/HiveHex";

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

// ── Password strength bar ─────────────────────────────────────────────────────

type Strength = "weak" | "fair" | "strong";

function PasswordStrengthBar({ strength }: { strength: Strength }) {
  const colors: Record<Strength, string> = {
    weak:   "#F87171",
    fair:   "#FBBF24",
    strong: "#34D399",
  };
  const fill = colors[strength];

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1">
        {(["weak", "fair", "strong"] as Strength[]).map((level, i) => {
          const idx = ["weak", "fair", "strong"].indexOf(strength);
          const active = i <= idx;
          return (
            <div
              key={level}
              className="h-[3px] w-8 rounded-full transition-colors duration-300"
              style={{ background: active ? fill : "rgba(255,255,255,0.08)" }}
            />
          );
        })}
      </div>
      <span className="text-[11px]" style={{ color: fill }}>
        {strength}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [checking,     setChecking]     = useState(true);
  const [error,        setError]        = useState("");

  // Bug fix: use /api/auth/me to check auth state, not getToken()
  // getToken() always returns truthy on the client so it can't be used for auth checks
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }),
      fetch("/api/auth/setup-required").then(async (r) => {
        if (!r.ok) throw new Error("setup-required check failed");
        return r.json() as Promise<{ setup_required: boolean }>;
      }),
    ])
      .then(([meRes, setupData]) => {
        if (meRes.ok) { router.replace("/dashboard"); return; }
        if (!setupData.setup_required) { router.replace("/login"); return; }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const passwordStrength: Strength | null = (() => {
    if (password.length === 0) return null;
    if (password.length < 10)  return "weak";
    if (password.length < 14)  return "fair";
    return "strong";
  })();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    if (password.length < 10)  { setError("Password must be at least 10 characters."); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await res.json() as { detail?: string };
      if (!res.ok) throw new Error(data.detail ?? "Registration failed");
      // Cookie is set by the server response — no token to store
      router.replace("/connect");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  const canSubmit =
    !loading &&
    password === confirm &&
    password.length >= 10 &&
    username.length >= 3;

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
          <HiveHex size={38} />
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
            <HiveHex size={48} />
            <h1 className="text-2xl font-bold text-ink-primary mt-3">HIVE</h1>
            <p className="text-[13px] text-ink-tertiary mt-1">Your money, your data, your rules.</p>
          </div>

          {/* Heading */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink-primary">
              Create your account
            </h2>
            <p className="text-[14px] text-ink-tertiary mt-1.5">
              First-time setup — choose your admin credentials.
            </p>
          </div>
          <div className="mb-6 lg:hidden">
            <h2 className="text-[20px] font-bold text-ink-primary text-center">Create your account</h2>
            <p className="text-[13px] text-ink-tertiary mt-1 text-center">Choose your admin credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="hive-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                pattern="[A-Za-z0-9_\-]{3,32}"
                placeholder="admin"
                className="hive-input w-full"
              />
              <p className="mt-1.5 text-[11px] text-ink-ghost">
                3–32 characters: letters, digits, _ or -
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="hive-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-ink-tertiary pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  className="hive-input w-full pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
                >
                  {showPassword
                    ? <EyeOff className="w-[15px] h-[15px]" />
                    : <Eye className="w-[15px] h-[15px]" />}
                </button>
              </div>
              {passwordStrength && <PasswordStrengthBar strength={passwordStrength} />}
            </div>

            {/* Confirm */}
            <div>
              <label className="hive-label">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-ink-tertiary pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  className={`hive-input w-full pl-9 pr-10 ${
                    confirm.length > 0 && password !== confirm
                      ? "border-semantic-expense/40 focus:border-semantic-expense/60"
                      : confirm.length > 0 && password === confirm
                      ? "border-semantic-income/40 focus:border-semantic-income/60"
                      : ""
                  }`}
                />
                {confirm.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {password === confirm
                      ? <CheckCircle2 className="w-[15px] h-[15px] text-semantic-income" />
                      : <AlertCircle className="w-[15px] h-[15px] text-semantic-expense" />}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-semantic-expense/[0.08] border border-semantic-expense/20 px-3 py-2.5">
                <AlertCircle className="w-[14px] h-[14px] text-semantic-expense shrink-0" />
                <p className="text-[13px] text-semantic-expense">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="hive-btn-primary w-full text-[14px] py-3 mt-2 group"
              style={{ opacity: canSubmit ? 1 : 0.4 }}
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black/80 animate-spin" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  Get started
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-ink-tertiary">
            Already have an account?{" "}
            <Link href="/login" className="text-honey hover:text-honey/80 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
