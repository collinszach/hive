"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Shield, Eye, EyeOff, AlertCircle } from "lucide-react";

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/setup-required")
      .then((r) => r.json())
      .then((d) => { if (d.setup_required) router.replace("/register"); })
      .catch(() => {});

    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => { if (r.ok) router.replace("/dashboard"); })
      .catch(() => {});
  }, [router]);

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Login failed");
      if (data.totp_required) { setStep("totp"); return; }
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, totp_code: totpCode }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Invalid MFA code");
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid MFA code");
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 relative overflow-hidden">

      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,185,66,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 80% 80%, rgba(245,185,66,0.03) 0%, transparent 60%)
          `,
        }}
      />

      <div className="w-full max-w-[360px] relative z-10">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4
                       bg-gradient-to-br from-honey to-honey-deep
                       shadow-[0_0_32px_rgba(245,185,66,0.30)]"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
              <path d="M10 2L16.928 6V14L10 18L3.072 14V6L10 2Z" fill="rgba(11,11,12,0.85)" />
              <path d="M10 5.5L14.33 8V13L10 15.5L5.67 13V8L10 5.5Z" fill="rgba(245,185,66,0.45)" />
              <circle cx="10" cy="10" r="1.5" fill="rgba(245,185,66,0.9)" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink-primary">HIVE</h1>
          <p className="text-[13px] text-ink-tertiary mt-1">Personal Finance Intelligence</p>
        </div>

        {/* Card */}
        <div className="hive-card p-7 shadow-card">
          {step === "credentials" ? (
            <>
              <div className="mb-6">
                <h2 className="text-[15px] font-semibold text-ink-primary">Welcome back</h2>
                <p className="text-[13px] text-ink-tertiary mt-0.5">Sign in to your account</p>
              </div>

              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-ink-tertiary mb-1.5 tracking-wide">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-ink-tertiary pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="admin"
                      className="hive-input pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-tertiary mb-1.5 tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-ink-tertiary pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="hive-input pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-semantic-expense/[0.08] border border-semantic-expense/20 px-3 py-2.5">
                    <AlertCircle className="w-[14px] h-[14px] text-semantic-expense shrink-0" />
                    <p className="text-[13px] text-semantic-expense">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="hive-btn-primary w-full mt-1"
                >
                  {loading ? "Signing in…" : "Continue"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-[10px] bg-honey/[0.1] border border-honey/20 flex items-center justify-center mb-3">
                  <Shield className="w-5 h-5 text-honey" />
                </div>
                <h2 className="text-[15px] font-semibold text-ink-primary">Two-factor auth</h2>
                <p className="text-[13px] text-ink-tertiary mt-0.5">
                  Enter the 6-digit code from your authenticator
                </p>
              </div>

              <form onSubmit={handleTotp} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="hive-input text-xl text-center font-mono tracking-[0.3em] placeholder-ink-tertiary/40"
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-semantic-expense/[0.08] border border-semantic-expense/20 px-3 py-2.5">
                    <AlertCircle className="w-[14px] h-[14px] text-semantic-expense shrink-0" />
                    <p className="text-[13px] text-semantic-expense">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="hive-btn-primary w-full"
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}
                  className="w-full py-2 text-[13px] text-ink-tertiary hover:text-ink-secondary transition-colors"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-tertiary/40 mt-6">
          Self-hosted · Private by design
        </p>
      </div>
    </div>
  );
}
