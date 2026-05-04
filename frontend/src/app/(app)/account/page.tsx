"use client";

import { useState, useEffect, FormEvent } from "react";
import { Shield, Key, Clock, User, CheckCircle, AlertCircle, Eye, EyeOff, QrCode, LogOut, Users, ChevronDown, Link2, PenLine, ArrowRight } from "lucide-react";
import { authedFetch, clearToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/Toast";

interface MeResponse {
  username: string;
  role: string;
  totp_enabled: boolean;
  last_login_at: string | null;
}

interface AuditEntry {
  id: string;
  event: string;
  username: string | null;
  ip_address: string | null;
  detail: string | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: "admin" | "viewer";
  plan: string;
  stripe_status: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // TOTP setup state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; provisioning_uri: string } | null>(null);
  const [totpQrUrl, setTotpQrUrl] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [showQr, setShowQr] = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<AdminUser[] | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authedFetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: MeResponse) => {
        setMe(data);
        // Fetch admin users if role is admin
        if (data.role === "admin") {
          setAdminLoading(true);
          authedFetch("/api/admin/users")
            .then((r) => r.ok ? r.json() : [])
            .then((users: AdminUser[]) => { setAdminUsers(users); setAdminLoading(false); })
            .catch(() => { setAdminLoading(false); });
        }
      })
      .catch(() => router.push("/login"));

    authedFetch("/api/auth/audit-log?limit=50")
      .then((r) => r.ok ? r.json() : [])
      .then(setAuditLog)
      .catch(() => {});
  }, [router]);

  async function startTotpSetup() {
    const r = await authedFetch("/api/auth/setup-totp", { method: "POST" });
    if (!r.ok) return toast.error("Failed to start MFA setup");
    const data = await r.json();
    setTotpSetup(data);

    const qrR = await authedFetch("/api/auth/setup-totp/qr");
    if (qrR.ok) {
      const blob = await qrR.blob();
      const url = URL.createObjectURL(blob);
      setTotpQrUrl(url);
    }
    setShowQr(true);
  }

  async function verifyTotp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await authedFetch("/api/auth/verify-totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totp_code: totpVerifyCode }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json();
      return toast.error(d.detail ?? "Invalid code");
    }
    toast.success("MFA enabled — your account is now protected with two-factor authentication");
    setTotpSetup(null);
    setTotpVerifyCode("");
    setShowQr(false);
    if (totpQrUrl) { URL.revokeObjectURL(totpQrUrl); setTotpQrUrl(null); }
    setMe((prev) => prev ? { ...prev, totp_enabled: true } : prev);
  }

  async function disableTotp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await authedFetch("/api/auth/disable-totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totp_code: totpDisableCode }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json();
      return toast.error(d.detail ?? "Invalid code");
    }
    toast.success("MFA disabled");
    setTotpDisableCode("");
    setMe((prev) => prev ? { ...prev, totp_enabled: false } : prev);
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await authedFetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json();
      return toast.error(d.detail ?? "Failed to change password");
    }
    toast.success("Password changed successfully");
    setCurrentPw("");
    setNewPw("");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  async function patchUser(id: string, patch: Partial<{ role: "admin" | "viewer"; plan: string; is_active: boolean }>) {
    try {
      const res = await authedFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error("Failed to update user");
        return;
      }
      const updated = await res.json() as AdminUser;
      setAdminUsers((prev) => prev ? prev.map((u) => u.id === id ? updated : u) : prev);
    } catch {
      toast.error("Failed to update user");
    }
  }

  const eventLabel: Record<string, string> = {
    login_success: "Signed in",
    login_failed: "Failed sign-in",
    login_mfa_pending: "MFA prompt",
    login_mfa_failed: "Failed MFA",
    mfa_enabled: "MFA enabled",
    mfa_disabled: "MFA disabled",
    password_changed: "Password changed",
    data_purge: "Data purge",
    data_retention_purge: "Retention purge",
  };

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Account &amp; Security</h1>
        <p className="text-[13px] text-ink-tertiary mt-0.5">Manage authentication, MFA, and access logs</p>
      </div>

      {/* Accounts */}
      <div className="hive-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Link2 className="w-4 h-4 text-ink-tertiary" />
          <h2 className="text-[13px] font-semibold text-ink-primary">Accounts</h2>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/connect" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors no-underline group">
            <div className="flex items-center gap-2.5">
              <Link2 className="w-3.5 h-3.5 text-ink-tertiary" />
              <span className="text-[13px] text-ink-secondary group-hover:text-ink-primary transition-colors">Connected Accounts</span>
              <span className="text-[11px] text-ink-ghost">Plaid-linked banks &amp; cards</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-ink-tertiary/50 group-hover:text-ink-tertiary transition-colors" />
          </Link>
          <Link href="/connect#manual" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors no-underline group">
            <div className="flex items-center gap-2.5">
              <PenLine className="w-3.5 h-3.5 text-ink-tertiary" />
              <span className="text-[13px] text-ink-secondary group-hover:text-ink-primary transition-colors">Manual Accounts</span>
              <span className="text-[11px] text-ink-ghost">Cash, off-platform assets</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-ink-tertiary/50 group-hover:text-ink-tertiary transition-colors" />
          </Link>
        </div>
      </div>

      {/* Profile */}
      {me && (
        <div className="hive-card-featured p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <User className="w-4 h-4 text-ink-tertiary" />
            <h2 className="text-[13px] font-semibold text-ink-primary">Profile</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="hive-label mb-1">Username</p>
              <p className="text-[13px] font-mono text-ink-primary">{me.username}</p>
            </div>
            <div>
              <p className="hive-label mb-1">Role</p>
              <span className="hive-badge hive-badge-honey capitalize">{me.role}</span>
            </div>
            <div>
              <p className="hive-label mb-1">MFA Status</p>
              <span className={`hive-badge ${me.totp_enabled ? "hive-badge-income" : "hive-badge-honey"}`}>
                <Shield className="w-3 h-3" />
                {me.totp_enabled ? "Enabled" : "Not enabled"}
              </span>
            </div>
            <div>
              <p className="hive-label mb-1">Last sign-in</p>
              <p className="text-[13px] text-ink-secondary">
                {me.last_login_at ? new Date(me.last_login_at).toLocaleString() : "—"}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 hive-divider">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[13px] text-ink-tertiary hover:text-semantic-expense transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* MFA Setup */}
      <div className="hive-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Shield className="w-4 h-4 text-honey" />
          <h2 className="text-[13px] font-semibold text-ink-primary">Two-Factor Authentication</h2>
        </div>

        {me?.totp_enabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[13px] text-semantic-income">
              <CheckCircle className="w-4 h-4 shrink-0" />
              MFA is active — your account requires an authenticator code at each sign-in
            </div>
            <form onSubmit={disableTotp} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="hive-label block mb-1.5">Enter your current MFA code to disable</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpDisableCode}
                  onChange={(e) => setTotpDisableCode(e.target.value.replace(/\D/g, ""))}
                  className="hive-input font-mono tracking-widest"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading || totpDisableCode.length !== 6}
                className="hive-btn-danger"
              >
                Disable MFA
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-honey flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              MFA is not enabled. Enable it to satisfy Plaid&apos;s security requirements.
            </p>

            {!totpSetup ? (
              <button onClick={startTotpSetup} className="hive-btn-primary">
                Set up authenticator app
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-elevated border border-white/[0.06] rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-ink-tertiary">
                    <QrCode className="w-3.5 h-3.5" />
                    Scan with Google Authenticator, Authy, or 1Password
                  </div>
                  {showQr && totpQrUrl && (
                    <div className="bg-white rounded-lg p-3 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={totpQrUrl} alt="TOTP QR code" className="w-40 h-40" />
                    </div>
                  )}
                  {showQr && !totpQrUrl && (
                    <div className="w-40 h-40 rounded-lg bg-surface border border-white/[0.06] flex items-center justify-center text-[11px] text-ink-tertiary">
                      Loading QR…
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-ink-tertiary mb-1">Or enter this secret manually:</p>
                    <code className="text-[11px] text-semantic-income font-mono bg-surface px-2 py-1 rounded">
                      {totpSetup.secret}
                    </code>
                  </div>
                </div>

                <form onSubmit={verifyTotp} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="hive-label block mb-1.5">Enter the 6-digit code to confirm</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpVerifyCode}
                      onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                      className="hive-input font-mono tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || totpVerifyCode.length !== 6}
                    className="hive-btn-primary"
                  >
                    Activate MFA
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="hive-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Key className="w-4 h-4 text-ink-tertiary" />
          <h2 className="text-[13px] font-semibold text-ink-primary">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="hive-label block mb-1.5">Current password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="hive-input pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
              >
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="hive-label block mb-1.5">New password</label>
            <input
              type={showPw ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={12}
              className="hive-input"
            />
            <p className="text-[11px] text-ink-tertiary/60 mt-1">Minimum 12 characters</p>
          </div>
          <button type="submit" disabled={loading} className="hive-btn-primary">
            Update password
          </button>
        </form>
      </div>

      {/* Audit Log */}
      <div className="hive-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Clock className="w-4 h-4 text-ink-tertiary" />
          <h2 className="text-[13px] font-semibold text-ink-primary">Access Audit Log</h2>
          <span className="ml-auto text-[11px] text-ink-tertiary">{auditLog.length} entries</span>
        </div>
        {auditLog.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No audit log entries yet.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-3 py-2 rounded-lg bg-elevated/50 text-[11px]"
              >
                <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.event.includes("failed") ? "bg-semantic-expense" :
                  entry.event.includes("success") || entry.event.includes("enabled") ? "bg-semantic-income" :
                  "bg-ink-ghost"
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-ink-primary font-medium">
                    {eventLabel[entry.event] ?? entry.event}
                  </span>
                  {entry.ip_address && (
                    <span className="text-ink-tertiary ml-1.5">from {entry.ip_address}</span>
                  )}
                  {entry.detail && (
                    <span className="text-ink-tertiary ml-1.5">— {entry.detail}</span>
                  )}
                </div>
                <span className="text-ink-ghost shrink-0 font-mono tabular-nums">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin: User Management — only visible to admins */}
      {me?.role === "admin" && (
        <div className="hive-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Users className="w-4 h-4 text-ink-tertiary" />
            <h2 className="text-[13px] font-semibold text-ink-primary">User Management</h2>
            {adminUsers && (
              <span className="ml-auto text-[11px] text-ink-tertiary">{adminUsers.length} users</span>
            )}
          </div>

          {adminLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !adminUsers || adminUsers.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider pr-4">User</th>
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider pr-4">Role</th>
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider pr-4">Plan</th>
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider pr-4">Stripe</th>
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider pr-4">Status</th>
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider pr-4">Last Login</th>
                    <th className="text-left pb-2 text-ink-tertiary font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="group">
                      {/* Username */}
                      <td className="py-2.5 pr-4">
                        <span className="font-mono text-ink-primary">{user.username}</span>
                      </td>

                      {/* Role dropdown */}
                      <td className="py-2.5 pr-4">
                        <div className="relative inline-flex items-center">
                          <select
                            value={user.role}
                            onChange={(e) => patchUser(user.id, { role: e.target.value as "admin" | "viewer" })}
                            className="appearance-none text-[11px] text-ink-secondary bg-transparent
                                       border border-white/[0.08] rounded-lg px-2 py-1 pr-5
                                       hover:border-white/[0.15] focus:outline-none cursor-pointer
                                       focus:border-honey/30 transition-colors"
                          >
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 w-2.5 h-2.5 text-ink-tertiary pointer-events-none" />
                        </div>
                      </td>

                      {/* Plan dropdown */}
                      <td className="py-2.5 pr-4">
                        <div className="relative inline-flex items-center">
                          <select
                            value={user.plan ?? "free"}
                            onChange={(e) => {
                              const newPlan = e.target.value;
                              if (!window.confirm(`Change ${user.username}'s plan to "${newPlan}"?`)) return;
                              patchUser(user.id, { plan: newPlan });
                            }}
                            className="appearance-none text-[11px] text-ink-secondary bg-transparent
                                       border border-white/[0.08] rounded-lg px-2 py-1 pr-5
                                       hover:border-white/[0.15] focus:outline-none cursor-pointer
                                       focus:border-honey/30 transition-colors"
                          >
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 w-2.5 h-2.5 text-ink-tertiary pointer-events-none" />
                        </div>
                      </td>

                      {/* Stripe status */}
                      <td className="py-2.5 pr-4 text-ink-tertiary font-mono tabular-nums">
                        {user.stripe_status ?? "—"}
                      </td>

                      {/* Active status */}
                      <td className="py-2.5 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            user.is_active
                              ? "bg-semantic-income/10 text-semantic-income border border-semantic-income/20"
                              : "bg-ink-ghost/10 text-ink-tertiary border border-white/[0.06]"
                          }`}
                        >
                          {user.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="py-2.5 pr-4 font-mono text-ink-tertiary tabular-nums">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : "—"}
                      </td>

                      {/* Disable/Enable toggle */}
                      <td className="py-2.5">
                        <button
                          onClick={() => patchUser(user.id, { is_active: !user.is_active })}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                            user.is_active
                              ? "text-semantic-expense hover:bg-semantic-expense/10 border border-semantic-expense/20"
                              : "text-semantic-income hover:bg-semantic-income/10 border border-semantic-income/20"
                          }`}
                        >
                          {user.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
