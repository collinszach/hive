// src/app/(marketing)/login/page.tsx
"use client";

import {
  useState, useEffect, useRef,
  FormEvent, KeyboardEvent, ClipboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import HiveHex from "../_components/HiveHex";

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

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

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
      else if (e.key === "ArrowRight") { e.preventDefault(); focusAt(i + 1); }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    focusAt(Math.min(pasted.length, 5));
  }

  return (
    <div className="flex gap-2.5 justify-center my-8">
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = value.length > i && value[i] !== " ";
        return (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={filled ? value[i] : ""}
            autoComplete="one-time-code"
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className="w-11 h-14 text-center text-[22px] font-mono font-medium rounded-xl outline-none transition-all duration-150"
            style={{
              background: filled ? "rgba(122,184,138,0.07)" : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${filled ? "rgba(122,184,138,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: "#EEEEF0",
              caretColor: "transparent",
              boxShadow: filled ? "0 0 14px rgba(122,184,138,0.07)" : "none",
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
  autoComplete,
  autoFocus,
  suffix,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-5">
      <label
        className="block text-[10px] font-semibold uppercase tracking-[0.18em] mb-2 transition-colors duration-150"
        style={{ color: focused ? "rgba(122,184,138,0.65)" : "rgba(255,255,255,0.22)" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent text-[15px] py-2 outline-none transition-all duration-150"
          style={{
            color: "#EEEEF0",
            borderBottom: `1.5px solid ${focused ? "rgba(122,184,138,0.50)" : "rgba(255,255,255,0.10)"}`,
            paddingRight: suffix ? 36 : 0,
            fontFamily: "inherit",
          }}
        />
        {suffix && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mt-4"
      style={{
        background: "rgba(248,113,113,0.07)",
        border: "1px solid rgba(248,113,113,0.18)",
      }}
    >
      <AlertCircle size={13} color="#F87171" className="shrink-0" />
      <span className="text-[12px] leading-snug" style={{ color: "#F87171" }}>
        {message}
      </span>
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
  const submittingRef = useRef(false);

  // Redirect if already authenticated; send to setup if no users yet
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => { if (r.ok) router.replace("/dashboard"); })
      .catch(() => {});
    fetch("/api/auth/setup-required")
      .then(safeJson)
      .then((d) => { if (d.setup_required) router.replace("/register"); })
      .catch(() => {});
  }, [router]);

  // Step 1: username + password
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

  // Step 2: TOTP code
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

  // Auto-submit TOTP once 6 digits entered
  useEffect(() => {
    if (step === "totp" && totpCode.replace(/\s/g, "").length === 6 && !submittingRef.current) {
      submittingRef.current = true;
      handleTotp({ preventDefault: () => {} } as FormEvent).finally(() => {
        submittingRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totpCode, step]);

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
            "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(122,184,138,0.07) 0%, transparent 70%)",
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
          <div className="flex justify-center mb-4">
            <HiveHex size={46} />
          </div>
          <p
            className="text-[36px] font-bold tracking-[0.3em]"
            style={{ color: "#F2EDE8", fontFamily: "var(--font-geist, inherit)" }}
          >
            HIVE
          </p>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mt-1" style={{ color: "rgba(255,255,255,0.18)" }}>
            Personal Finance Intelligence
          </p>
        </div>

        {/* Form */}
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
                  onClick={() => setShowPw((p) => !p)}
                  className="flex items-center justify-center p-1 transition-colors duration-150"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
            {error && <ErrorBanner message={error} />}
            <button
              type="submit"
              disabled={loading}
              className="hive-btn-primary w-full mt-7 py-3 text-[13px] rounded-xl"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp}>
            <div className="text-center">
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-honey mb-2">
                Two-factor auth
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                Enter the 6-digit code from
                <br />
                your authenticator app
              </p>
            </div>
            <TotpBoxes value={totpCode} onChange={setTotpCode} />
            {error && <ErrorBanner message={error} />}
            <button
              type="submit"
              disabled={loading || totpCode.replace(/\s/g, "").length !== 6}
              className="hive-btn-primary w-full py-3 text-[13px] rounded-xl mt-4"
              style={{ opacity: (loading || totpCode.replace(/\s/g, "").length !== 6) ? 0.35 : 1 }}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}
              className="w-full py-3 mt-2 text-[12px] transition-colors duration-150"
              style={{ color: "rgba(255,255,255,0.2)", background: "none", border: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
            >
              ← Back
            </button>
          </form>
        )}

        {/* Footer links */}
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
