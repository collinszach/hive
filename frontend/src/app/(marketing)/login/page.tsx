"use client";

import {
  useState, useEffect, useRef,
  FormEvent, KeyboardEvent, ClipboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return {};
  try { return await res.json(); } catch { return {}; }
}

// ── 6-box TOTP input ──────────────────────────────────────────────────────────

function TotpBoxes({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function focusAt(i: number) {
    inputRefs.current[Math.max(0, Math.min(5, i))]?.focus();
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    const arr = (value + "      ").slice(0, 6).split("");
    arr[i] = digit;
    const next = arr.join("").trimEnd();
    onChange(next);
    if (i < 5) focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) {
        const arr = (value + "      ").slice(0, 6).split("");
        arr[i] = " ";
        onChange(arr.join("").trimEnd());
      } else if (i > 0) {
        const arr = (value + "      ").slice(0, 6).split("");
        arr[i - 1] = " ";
        onChange(arr.join("").trimEnd());
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft")  { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === "ArrowRight")   { e.preventDefault(); focusAt(i + 1); }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    focusAt(Math.min(pasted.length, 5));
  }

  return (
    <div style={{ display: "flex", gap: 9, justifyContent: "center", margin: "30px 0 32px" }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = value.length > i && value[i] !== " ";
        return (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={filled ? value[i] : ""}
            autoComplete="one-time-code"
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            style={{
              width:         46,
              height:        58,
              borderRadius:  10,
              border:        `1.5px solid ${filled
                ? "rgba(245,185,66,0.45)"
                : "rgba(255,255,255,0.07)"}`,
              background:    filled
                ? "rgba(245,185,66,0.07)"
                : "rgba(255,255,255,0.025)",
              color:         "#F2EDE8",
              fontSize:      24,
              fontFamily:    "var(--font-mono, 'JetBrains Mono', monospace)",
              fontWeight:    500,
              textAlign:     "center",
              outline:       "none",
              caretColor:    "transparent",
              transition:    "border-color 120ms, background 120ms",
              boxShadow:     filled ? "0 0 16px rgba(245,185,66,0.08)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  suffix,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display:       "block",
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color:         focused ? "rgba(245,185,66,0.7)" : "rgba(255,255,255,0.2)",
        marginBottom:  8,
        transition:    "color 150ms",
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width:          "100%",
            boxSizing:      "border-box",
            background:     "transparent",
            border:         "none",
            borderBottom:   `1.5px solid ${focused
              ? "rgba(245,185,66,0.55)"
              : "rgba(255,255,255,0.09)"}`,
            borderRadius:   0,
            color:          "#F2EDE8",
            fontSize:       15,
            padding:        "8px 0",
            paddingRight:   suffix ? 36 : 0,
            outline:        "none",
            transition:     "border-color 150ms",
            fontFamily:     "inherit",
          }}
        />
        {suffix && (
          <div style={{
            position:  "absolute",
            right:     0,
            top:       "50%",
            transform: "translateY(-50%)",
          }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();

  const [step,     setStep]     = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

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

  // Auto-submit TOTP once 6 digits are entered
  useEffect(() => {
    if (step === "totp" && totpCode.replace(/\s/g, "").length === 6 && !loading) {
      handleTotp({ preventDefault: () => {} } as FormEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totpCode, step]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes ln-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes ln-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1;   }
        }

        .ln-wrap   { animation: ln-rise 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .ln-brand  { animation: ln-rise 0.7s 0.05s cubic-bezier(0.16,1,0.3,1) both; }
        .ln-form   { animation: ln-rise 0.7s 0.12s cubic-bezier(0.16,1,0.3,1) both; }

        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #070810 inset !important;
          -webkit-text-fill-color: #F2EDE8 !important;
          caret-color: #F2EDE8;
        }
      `}</style>

      <div style={{
        minHeight:       "100vh",
        background:      "#070810",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "24px 20px",
        position:        "relative",
        overflow:        "hidden",
        fontFamily:      "system-ui, -apple-system, sans-serif",
      }}>

        {/* ── Hexagonal grid background ── */}
        <svg
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.028 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="hex-grid" x="0" y="0" width="56" height="48.5" patternUnits="userSpaceOnUse">
              <polygon
                points="28,2 50,14 50,38 28,50 6,38 6,14"
                fill="none"
                stroke="#F5B942"
                strokeWidth="0.8"
              />
              <polygon
                points="56,26 78,38 78,62 56,74 34,62 34,38"
                fill="none"
                stroke="#F5B942"
                strokeWidth="0.8"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-grid)" />
        </svg>

        {/* ── Top amber glow ── */}
        <div aria-hidden style={{
          position:    "absolute",
          top:         "-15%",
          left:        "50%",
          transform:   "translateX(-50%)",
          width:       860,
          height:      500,
          borderRadius: "50%",
          background:  "radial-gradient(ellipse, rgba(245,185,66,0.055) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* ── Content ── */}
        <div className="ln-wrap" style={{ width: "100%", maxWidth: 340, position: "relative", zIndex: 1 }}>

          {/* ── Brand ── */}
          <div className="ln-brand" style={{ textAlign: "center", marginBottom: 52 }}>
            {/* Hex logo mark */}
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <svg viewBox="0 0 64 64" fill="none" style={{ width: 48, height: 48 }}>
                <polygon
                  points="32,4 56,18 56,46 32,60 8,46 8,18"
                  stroke="rgba(245,185,66,0.35)"
                  strokeWidth="1.2"
                  fill="rgba(245,185,66,0.04)"
                />
                <polygon
                  points="32,14 46,22 46,38 32,46 18,38 18,22"
                  stroke="rgba(245,185,66,0.2)"
                  strokeWidth="1"
                  fill="rgba(245,185,66,0.03)"
                />
                <circle cx="32" cy="32" r="4" fill="#F5B942" opacity="0.9" />
                <circle cx="32" cy="32" r="2" fill="#FCD56A" />
              </svg>
            </div>

            <p style={{
              fontFamily:    "'Cormorant Garamond', Georgia, serif",
              fontSize:      38,
              fontWeight:    300,
              color:         "#F2EDE8",
              letterSpacing: "0.35em",
              lineHeight:    1,
              marginBottom:  8,
            }}>
              HIVE
            </p>
            <p style={{
              fontSize:      9,
              fontWeight:    600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color:         "rgba(255,255,255,0.18)",
            }}>
              Personal Finance Intelligence
            </p>
          </div>

          {/* ── Form ── */}
          <div className="ln-form">
            {step === "credentials" ? (
              <form onSubmit={handleCredentials}>
                <Field
                  label="Username"
                  type="text"
                  value={username}
                  onChange={setUsername}
                  autoComplete="username"
                  autoFocus
                />
                <Field
                  label="Password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      style={{
                        background: "none",
                        border:     "none",
                        cursor:     "pointer",
                        color:      "rgba(255,255,255,0.25)",
                        display:    "flex",
                        padding:    4,
                        transition: "color 150ms",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />

                {error && <ErrorBanner message={error} />}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width:        "100%",
                    padding:      "13px 0",
                    marginTop:    28,
                    borderRadius: 10,
                    background:   loading
                      ? "rgba(245,185,66,0.3)"
                      : "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
                    color:        "#07060A",
                    fontSize:     13,
                    fontWeight:   700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border:       "none",
                    cursor:       loading ? "not-allowed" : "pointer",
                    boxShadow:    loading ? "none" : "0 0 32px rgba(245,185,66,0.22)",
                    transition:   "opacity 150ms, box-shadow 150ms",
                    fontFamily:   "inherit",
                  }}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleTotp}>
                <div style={{ textAlign: "center" }}>
                  <p style={{
                    fontSize:      9,
                    fontWeight:    700,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color:         "rgba(245,185,66,0.6)",
                    marginBottom:  10,
                  }}>
                    Two-factor auth
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
                    Enter the 6-digit code from<br />your authenticator app
                  </p>
                </div>

                <TotpBoxes value={totpCode} onChange={setTotpCode} />

                {error && <ErrorBanner message={error} />}

                <button
                  type="submit"
                  disabled={loading || totpCode.replace(/\s/g, "").length !== 6}
                  style={{
                    width:        "100%",
                    padding:      "13px 0",
                    marginTop:    error ? 16 : 0,
                    borderRadius: 10,
                    background:   "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
                    color:        "#07060A",
                    fontSize:     13,
                    fontWeight:   700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border:       "none",
                    cursor:       (loading || totpCode.replace(/\s/g, "").length !== 6) ? "not-allowed" : "pointer",
                    opacity:      (loading || totpCode.replace(/\s/g, "").length !== 6) ? 0.35 : 1,
                    boxShadow:    "0 0 32px rgba(245,185,66,0.22)",
                    transition:   "opacity 150ms",
                    fontFamily:   "inherit",
                  }}
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}
                  style={{
                    width:      "100%",
                    padding:    "12px 0",
                    marginTop:  6,
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    fontSize:   12,
                    color:      "rgba(255,255,255,0.2)",
                    transition: "color 150ms",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
                >
                  ← Back
                </button>
              </form>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{
            display:        "flex",
            justifyContent: "center",
            gap:            24,
            marginTop:      48,
          }}>
            {[["Home", "/"], ["Privacy", "/privacy"]].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize:   11,
                  color:      "rgba(255,255,255,0.15)",
                  textDecoration: "none",
                  transition: "color 150ms",
                }}
                onMouseEnter={e => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.4)")}
                onMouseLeave={e => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.15)")}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          8,
      background:   "rgba(248,113,113,0.07)",
      border:       "1px solid rgba(248,113,113,0.18)",
      borderRadius: 9,
      padding:      "10px 12px",
      marginTop:    16,
    }}>
      <AlertCircle size={13} color="#F87171" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "#F87171", lineHeight: 1.4 }}>{message}</span>
    </div>
  );
}
