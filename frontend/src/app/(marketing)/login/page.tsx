"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, User, Shield, Eye, EyeOff, AlertCircle } from "lucide-react";

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return {};
  try { return await res.json(); } catch { return {}; }
}

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => { if (r.ok) router.replace("/dashboard"); })
      .catch(() => {});
    fetch("/api/auth/setup-required")
      .then(safeJson)
      .then(d => { if (d.setup_required) router.replace("/register"); })
      .catch(() => {});
  }, [router]);

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(String(data.detail ?? `Login failed (${res.status})`));
      if (data.totp_required) { setStep("totp"); return; }
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, totp_code: totpCode }),
        credentials: "include",
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(String(data.detail ?? "Invalid code"));
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid MFA code");
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Inline styles to guarantee rendering independent of Tailwind */}
      <style>{`
        .login-page {
          min-height: 100vh;
          background: #09090E;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .login-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 70% 40% at 50% 0%, rgba(245,185,66,0.06) 0%, transparent 65%);
        }
        .login-wrap {
          width: 100%;
          max-width: 380px;
          position: relative;
          z-index: 1;
        }
        .login-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 32px;
        }
        .login-hex {
          width: 52px;
          height: 52px;
          border-radius: 15px;
          background: linear-gradient(135deg, #F5B942, #C9920E);
          box-shadow: 0 0 0 1px rgba(245,185,66,0.5), 0 8px 28px rgba(245,185,66,0.30);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .login-title {
          font-size: 20px;
          font-weight: 700;
          color: #F2EDE8;
          letter-spacing: 0.07em;
          margin: 0 0 4px;
        }
        .login-subtitle {
          font-size: 13px;
          color: #5A5450;
          margin: 0;
        }
        .login-card {
          background: #18181F;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
        }
        .login-card-title {
          font-size: 17px;
          font-weight: 600;
          color: #F2EDE8;
          margin: 0 0 4px;
        }
        .login-card-sub {
          font-size: 13px;
          color: #6A6460;
          margin: 0 0 24px;
        }
        .login-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #9A9290;
          margin-bottom: 7px;
          letter-spacing: 0.03em;
        }
        .login-field {
          position: relative;
          margin-bottom: 16px;
        }
        .login-input {
          width: 100%;
          box-sizing: border-box;
          background: #0E0E16 !important;
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 11px;
          color: #F2EDE8 !important;
          font-size: 14px;
          padding: 11px 12px;
          outline: none;
          transition: border-color 150ms;
          -webkit-text-fill-color: #F2EDE8 !important;
        }
        .login-input::placeholder {
          color: #3A3630 !important;
          -webkit-text-fill-color: #3A3630 !important;
        }
        .login-input:focus {
          border-color: #F5B942;
          box-shadow: 0 0 0 3px rgba(245,185,66,0.12);
        }
        .login-input-padl { padding-left: 40px; }
        .login-input-padr { padding-right: 42px; }
        .login-icon-l {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #4A4640;
          pointer-events: none;
          display: flex;
        }
        .login-icon-r {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #4A4640;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          transition: color 150ms;
        }
        .login-icon-r:hover { color: #9A9290; }
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.22);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 16px;
        }
        .login-error-text {
          font-size: 13px;
          color: #F87171;
        }
        .login-btn {
          width: 100%;
          padding: 12px 0;
          border-radius: 11px;
          background: linear-gradient(135deg, #F5B942, #C9920E);
          color: #09090E;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(245,185,66,0.28);
          transition: opacity 150ms, box-shadow 150ms;
        }
        .login-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
        .login-btn-ghost {
          width: 100%;
          padding: 10px 0;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          color: #5A5450;
          transition: color 150ms;
          margin-top: 6px;
        }
        .login-btn-ghost:hover { color: #C8BFB4; }
        .login-footer {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 20px;
        }
        .login-footer a {
          font-size: 12px;
          color: #3A3630;
          text-decoration: none;
          transition: color 150ms;
        }
        .login-footer a:hover { color: #7A7268; }
        .totp-shield {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(245,185,66,0.09);
          border: 1px solid rgba(245,185,66,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .totp-input {
          font-size: 26px !important;
          font-family: monospace !important;
          text-align: center;
          letter-spacing: 0.4em;
          padding: 14px 12px !important;
          margin-bottom: 16px;
        }
      `}</style>

      <div className="login-page">
        <div className="login-glow" aria-hidden />

        <div className="login-wrap">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-hex">
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 28, height: 28 }}>
                <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="rgba(9,8,7,.8)" />
                <path d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z" fill="rgba(245,185,66,.4)" />
                <circle cx="12" cy="12" r="2" fill="rgba(9,8,7,.9)" />
                <circle cx="12" cy="12" r="1" fill="rgba(245,185,66,.95)" />
              </svg>
            </div>
            <h1 className="login-title">HIVE</h1>
            <p className="login-subtitle">Personal Finance Intelligence</p>
          </div>

          {/* Card */}
          <div className="login-card">
            {step === "credentials" ? (
              <>
                <h2 className="login-card-title">Welcome back</h2>
                <p className="login-card-sub">Sign in to your account</p>

                <form onSubmit={handleCredentials}>
                  {/* Username */}
                  <label className="login-label">Username</label>
                  <div className="login-field">
                    <span className="login-icon-l">
                      <User size={15} />
                    </span>
                    <input
                      className="login-input login-input-padl"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="admin"
                    />
                  </div>

                  {/* Password */}
                  <label className="login-label">Password</label>
                  <div className="login-field" style={{ marginBottom: 20 }}>
                    <span className="login-icon-l">
                      <Lock size={15} />
                    </span>
                    <input
                      className="login-input login-input-padl login-input-padr"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="login-icon-r"
                      onClick={() => setShowPw(p => !p)}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {error && (
                    <div className="login-error">
                      <AlertCircle size={14} color="#F87171" style={{ flexShrink: 0 }} />
                      <span className="login-error-text">{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="login-btn">
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="totp-shield">
                  <Shield size={20} color="#F5B942" />
                </div>
                <h2 className="login-card-title">Two-factor auth</h2>
                <p className="login-card-sub">Enter the 6-digit code from your authenticator app</p>

                <form onSubmit={handleTotp}>
                  <input
                    className="login-input totp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    placeholder="000000"
                  />

                  {error && (
                    <div className="login-error">
                      <AlertCircle size={14} color="#F87171" style={{ flexShrink: 0 }} />
                      <span className="login-error-text">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || totpCode.length !== 6}
                    className="login-btn"
                  >
                    {loading ? "Verifying…" : "Verify"}
                  </button>

                  <button
                    type="button"
                    className="login-btn-ghost"
                    onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}
                  >
                    ← Back to sign in
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="login-footer">
            <Link href="/">Home</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </div>
    </>
  );
}
