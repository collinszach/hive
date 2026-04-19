"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, User, Shield, Eye, EyeOff, AlertCircle } from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return {};
  try { return await res.json(); } catch { return {}; }
}

// ── design tokens ─────────────────────────────────────────────────────────────
const BG      = "#09090E";
const SURFACE = "#13131A";
const BORDER  = "rgba(255,255,255,0.07)";
const A       = "#F5B942";
const A_DIM   = "rgba(245,185,66,0.09)";
const A_GLOW  = "rgba(245,185,66,0.28)";
const TEXT    = "#E8E2DA";
const MUTED   = "#7A7268";
const ERR     = "#F87171";
const ERR_BG  = "rgba(248,113,113,0.08)";
const ERR_BD  = "rgba(248,113,113,0.2)";

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep]           = useState<Step>("credentials");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [totpCode, setTotpCode]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    // Redirect if already logged in
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => { if (r.ok) router.replace("/dashboard"); })
      .catch(() => {});
    // Redirect to setup if no account exists yet
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
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ username, password }),
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
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ username, password, totp_code: totpCode }),
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

  // ── shared input style ───────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width:           "100%",
    background:      "#0D0D14",
    border:          `1px solid ${BORDER}`,
    borderRadius:    10,
    color:           TEXT,
    fontSize:        14,
    padding:         "10px 12px",
    outline:         "none",
    transition:      "border-color 150ms",
    boxSizing:       "border-box",
  };

  return (
    <div
      style={{
        minHeight:      "100vh",
        background:     BG,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "24px 16px",
        position:       "relative",
        overflow:       "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position:       "absolute",
          inset:          0,
          pointerEvents:  "none",
          background:     `radial-gradient(ellipse 70% 50% at 50% 0%,${A_GLOW.replace("0.28","0.05")} 0%,transparent 70%)`,
        }}
      />

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>

        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <div
            style={{
              width:        48,
              height:       48,
              borderRadius: 14,
              background:   "linear-gradient(135deg,#F5B942,#C9920E)",
              boxShadow:    `0 0 0 1px rgba(245,185,66,.4),0 6px 24px ${A_GLOW}`,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 26, height: 26 }}>
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="rgba(9,8,7,.8)" />
              <path d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z" fill="rgba(245,185,66,.4)" />
              <circle cx="12" cy="12" r="2"   fill="rgba(9,8,7,.9)" />
              <circle cx="12" cy="12" r="1"   fill="rgba(245,185,66,.95)" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: "0.06em", margin: 0 }}>
            HIVE
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Personal Finance Intelligence</p>
        </div>

        {/* Card */}
        <div
          style={{
            background:   SURFACE,
            border:       `1px solid ${BORDER}`,
            borderRadius: 18,
            padding:      32,
            boxShadow:    "0 24px 48px rgba(0,0,0,.5)",
          }}
        >
          {step === "credentials" ? (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: "0 0 4px" }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 24px" }}>
                Sign in to your account
              </p>

              <form onSubmit={handleCredentials}>
                {/* Username */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 6, letterSpacing: "0.04em" }}>
                    Username
                  </label>
                  <div style={{ position: "relative" }}>
                    <User
                      style={{
                        position:  "absolute",
                        left:      12,
                        top:       "50%",
                        transform: "translateY(-50%)",
                        width:     15,
                        height:    15,
                        color:     MUTED,
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="admin"
                      style={{ ...inputStyle, paddingLeft: 38 }}
                      onFocus={e  => (e.target.style.borderColor = A)}
                      onBlur={e   => (e.target.style.borderColor = BORDER)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 6, letterSpacing: "0.04em" }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock
                      style={{
                        position:  "absolute",
                        left:      12,
                        top:       "50%",
                        transform: "translateY(-50%)",
                        width:     15,
                        height:    15,
                        color:     MUTED,
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingLeft: 38, paddingRight: 40 }}
                      onFocus={e => (e.target.style.borderColor = A)}
                      onBlur={e  => (e.target.style.borderColor = BORDER)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      style={{
                        position:   "absolute",
                        right:      12,
                        top:        "50%",
                        transform:  "translateY(-50%)",
                        background: "none",
                        border:     "none",
                        cursor:     "pointer",
                        color:      MUTED,
                        padding:    0,
                        display:    "flex",
                      }}
                    >
                      {showPw
                        ? <EyeOff style={{ width: 15, height: 15 }} />
                        : <Eye    style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          8,
                      background:   ERR_BG,
                      border:       `1px solid ${ERR_BD}`,
                      borderRadius: 10,
                      padding:      "10px 12px",
                      marginBottom: 16,
                    }}
                  >
                    <AlertCircle style={{ width: 14, height: 14, color: ERR, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: ERR }}>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width:        "100%",
                    padding:      "11px 0",
                    borderRadius: 10,
                    background:   loading ? "rgba(245,185,66,.5)" : "linear-gradient(135deg,#F5B942,#C9920E)",
                    color:        "#09090E",
                    fontSize:     14,
                    fontWeight:   600,
                    border:       "none",
                    cursor:       loading ? "not-allowed" : "pointer",
                    boxShadow:    loading ? "none" : `0 4px 16px ${A_GLOW}`,
                    transition:   "all 150ms",
                  }}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* TOTP step */}
              <div
                style={{
                  width:        40,
                  height:       40,
                  borderRadius: 10,
                  background:   A_DIM,
                  border:       `1px solid rgba(245,185,66,.2)`,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Shield style={{ width: 18, height: 18, color: A }} />
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: "0 0 4px" }}>
                Two-factor authentication
              </h2>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 24px" }}>
                Enter the 6-digit code from your authenticator app
              </p>

              <form onSubmit={handleTotp}>
                <input
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
                  style={{
                    ...inputStyle,
                    fontSize:       22,
                    fontFamily:     "monospace",
                    textAlign:      "center",
                    letterSpacing:  "0.35em",
                    padding:        "14px 12px",
                    marginBottom:   16,
                  }}
                  onFocus={e => (e.target.style.borderColor = A)}
                  onBlur={e  => (e.target.style.borderColor = BORDER)}
                />

                {error && (
                  <div
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          8,
                      background:   ERR_BG,
                      border:       `1px solid ${ERR_BD}`,
                      borderRadius: 10,
                      padding:      "10px 12px",
                      marginBottom: 16,
                    }}
                  >
                    <AlertCircle style={{ width: 14, height: 14, color: ERR, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: ERR }}>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  style={{
                    width:        "100%",
                    padding:      "11px 0",
                    borderRadius: 10,
                    background:   (loading || totpCode.length !== 6) ? "rgba(245,185,66,.4)" : "linear-gradient(135deg,#F5B942,#C9920E)",
                    color:        "#09090E",
                    fontSize:     14,
                    fontWeight:   600,
                    border:       "none",
                    cursor:       (loading || totpCode.length !== 6) ? "not-allowed" : "pointer",
                    boxShadow:    (loading || totpCode.length !== 6) ? "none" : `0 4px 16px ${A_GLOW}`,
                    marginBottom: 10,
                    transition:   "all 150ms",
                  }}
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}
                  style={{
                    width:      "100%",
                    padding:    "9px 0",
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    fontSize:   13,
                    color:      MUTED,
                    transition: "color 150ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                  onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer links */}
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 20 }}>
          <Link href="/"        style={{ fontSize: 12, color: "#3A3630", textDecoration: "none" }}>Home</Link>
          <Link href="/pricing" style={{ fontSize: 12, color: "#3A3630", textDecoration: "none" }}>Pricing</Link>
          <Link href="/privacy" style={{ fontSize: 12, color: "#3A3630", textDecoration: "none" }}>Privacy</Link>
        </div>
      </div>
    </div>
  );
}
