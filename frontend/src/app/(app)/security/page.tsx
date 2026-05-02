"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  Shield, CheckCircle, AlertCircle, Lock, Users, Eye, Trash2,
  FileText, RefreshCw, ChevronDown, ChevronUp, Server, Globe,
} from "lucide-react";
import { authedFetch } from "@/lib/auth";
import { toast } from "@/components/Toast";

interface MeResponse {
  username: string;
  role: string;
  totp_enabled: boolean;
}

interface PolicySection {
  id: string;
  title: string;
  icon: React.ReactNode;
  attestation: string;
  status: "implemented" | "partial" | "policy";
  content: React.ReactNode;
}

export default function SecurityPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    authedFetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePurge(e: FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== "DELETE ALL MY DATA") return;
    setDeleteLoading(true);
    const r = await authedFetch("/api/admin/purge-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE ALL MY DATA" }),
    });
    setDeleteLoading(false);
    const d = await r.json();
    if (r.ok) {
      toast.success(d.message ?? "Data deleted successfully");
      setDeleteConfirm("");
    } else {
      toast.error(d.detail ?? "Deletion failed");
    }
  }

  const statusBadge = (status: PolicySection["status"]) => (
    <span className={`hive-badge ${
      status === "implemented" ? "hive-badge-income" :
      status === "partial"     ? "hive-badge-honey" :
      "bg-ink-ghost/30 text-ink-secondary border border-white/[0.08]"
    }`}>
      {status === "implemented" ? <CheckCircle className="w-3 h-3" /> :
       status === "partial"     ? <AlertCircle  className="w-3 h-3" /> :
       <FileText className="w-3 h-3" />}
      {status === "implemented" ? "Implemented" : status === "partial" ? "Partial" : "Policy"}
    </span>
  );

  const policies: PolicySection[] = [
    {
      id: "rbac",
      title: "Role-Based Access Control (RBAC)",
      icon: <Users className="w-4 h-4 text-honey" />,
      attestation: "Attest that your organization has implemented role-based access control (RBAC)",
      status: "implemented",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p>Hive Finance implements RBAC with two roles:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-ink-primary">admin</strong> — Full access to all data, settings, admin APIs, and data deletion</li>
            <li><strong className="text-ink-primary">viewer</strong> — Read-only access to financial data; cannot modify settings or delete data</li>
          </ul>
          <p>All API endpoints enforce role-based authorization via JWT claims. The <code className="text-honey text-[11px]">role</code> claim is set at login and verified on every request to privileged endpoints.</p>
          <p>Current user role: <span className="text-ink-primary font-medium capitalize">{me?.role ?? "—"}</span></p>
        </div>
      ),
    },
    {
      id: "secure-tokens",
      title: "Secure Tokens & Certificates for Authentication",
      icon: <Lock className="w-4 h-4 text-honey" />,
      attestation: "Attest that your organization uses secure tokens and certificates for authentication",
      status: "implemented",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong className="text-ink-primary">JWT tokens</strong> — HS256-signed, 12-hour expiry, stored client-side in localStorage. Token includes username and role claims.</li>
            <li><strong className="text-ink-primary">TLS certificates</strong> — Tailscale-provisioned certificates on the reverse proxy (nginx). All traffic is TLS 1.2+ encrypted.</li>
            <li><strong className="text-ink-primary">Plaid access tokens</strong> — Stored encrypted at rest using AES-256 (Fernet). Never exposed to the frontend.</li>
            <li><strong className="text-ink-primary">Database passwords</strong> — 100+ character random passwords. Redis requires password authentication.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "mfa-consumer",
      title: "MFA on Consumer-Facing Application",
      icon: <Shield className="w-4 h-4 text-honey" />,
      attestation: "Attest that your organization has implemented multi-factor authentication (MFA) on the consumer-facing application where Plaid Link is deployed",
      status: me?.totp_enabled ? "implemented" : "partial",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p>Hive Finance supports TOTP-based two-factor authentication (RFC 6238). Compatible with Google Authenticator, Authy, 1Password, and any TOTP app.</p>
          <p>MFA status for current account: {me?.totp_enabled ? (
            <span className="text-semantic-income font-medium">Enabled</span>
          ) : (
            <span className="text-honey font-medium">Not enabled — <a href="/account" className="underline hover:opacity-80 transition-opacity">enable it now</a></span>
          )}</p>
          <p>Additionally, the application is only accessible via Tailscale VPN, which requires device enrollment and account-level authentication — providing an additional factor at the network layer.</p>
        </div>
      ),
    },
    {
      id: "deprovisioning",
      title: "Automated De-provisioning",
      icon: <Users className="w-4 h-4 text-ink-tertiary" />,
      attestation: "Attest that your organization has implemented automated de-provisioning/modification of access for terminated or transferred employees",
      status: "policy",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p><strong className="text-ink-primary">Scope:</strong> Hive Finance is a single-user, self-hosted personal application. There are no employees or organizational accounts.</p>
          <p><strong className="text-ink-primary">Policy:</strong> Access is controlled by the single admin user. If access needs to be revoked, the admin can deactivate or delete the account via the user management API. JWT tokens expire after 12 hours, ensuring automatic access termination without explicit logout.</p>
          <p><strong className="text-ink-primary">Tailscale enforcement:</strong> Network access is gated by Tailscale device enrollment. Removing a device from the tailnet immediately terminates access regardless of valid JWT tokens.</p>
        </div>
      ),
    },
    {
      id: "access-reviews",
      title: "Periodic Access Reviews & Audits",
      icon: <Eye className="w-4 h-4 text-honey" />,
      attestation: "Attest that your organization performs periodic access reviews and audits",
      status: "implemented",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p>All authentication events are written to an append-only audit log (<code className="text-honey text-[11px]">audit_logs</code> table) including:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Successful and failed login attempts (IP address, timestamp, user agent)</li>
            <li>MFA enable/disable events</li>
            <li>Password change events</li>
            <li>Data deletion and purge operations</li>
          </ul>
          <p>The audit log is reviewable on the <a href="/account" className="text-honey underline hover:opacity-80 transition-opacity">Account page</a>. Access reviews should be performed quarterly by the system administrator.</p>
        </div>
      ),
    },
    {
      id: "mfa-internal",
      title: "MFA on Internal Systems",
      icon: <Server className="w-4 h-4 text-honey" />,
      attestation: "Attest that your organization has implemented multi-factor authentication (MFA) on internal systems that store or process consumer data",
      status: "implemented",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p>Internal systems (PostgreSQL, Redis, backend API) are accessible exclusively via:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong className="text-ink-primary">Tailscale VPN:</strong> Requires device enrollment + Tailscale account login (supports MFA at the identity provider level)</li>
            <li><strong className="text-ink-primary">localhost-only binding:</strong> All services bind to 127.0.0.1 — not reachable from the network without Tailscale tunnel</li>
            <li><strong className="text-ink-primary">Password authentication:</strong> PostgreSQL and Redis both require passwords; SSH access to the host requires key-based authentication</li>
          </ul>
        </div>
      ),
    },
    {
      id: "patching",
      title: "Vulnerability Patching SLA",
      icon: <RefreshCw className="w-4 h-4 text-ink-tertiary" />,
      attestation: "Attest that your organization patches identified vulnerabilities within a defined SLA",
      status: "policy",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p className="font-medium text-ink-primary">Vulnerability Management Policy</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 text-ink-tertiary">Severity</th>
                <th className="text-left py-2 text-ink-tertiary">Definition</th>
                <th className="text-left py-2 text-ink-tertiary">Patch SLA</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.04]">
                <td className="py-2 text-semantic-expense font-medium">Critical</td>
                <td className="py-2 text-ink-secondary">CVSS 9.0–10.0; active exploitation; RCE</td>
                <td className="py-2 text-ink-primary">48 hours</td>
              </tr>
              <tr className="border-b border-white/[0.04]">
                <td className="py-2 text-honey font-medium">High</td>
                <td className="py-2 text-ink-secondary">CVSS 7.0–8.9; data exposure risk</td>
                <td className="py-2 text-ink-primary">7 days</td>
              </tr>
              <tr className="border-b border-white/[0.04]">
                <td className="py-2 text-honey font-medium">Medium</td>
                <td className="py-2 text-ink-secondary">CVSS 4.0–6.9</td>
                <td className="py-2 text-ink-primary">30 days</td>
              </tr>
              <tr>
                <td className="py-2 text-ink-tertiary font-medium">Low</td>
                <td className="py-2 text-ink-secondary">CVSS 0.1–3.9</td>
                <td className="py-2 text-ink-primary">90 days</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: "eol",
      title: "End-of-Life (EOL) Software Management",
      icon: <RefreshCw className="w-4 h-4 text-ink-tertiary" />,
      attestation: "Attest that your organization monitors end-of-life (EOL) software in use and updates policies to include EOL management practices",
      status: "policy",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p className="font-medium text-ink-primary">EOL Monitoring Policy</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong className="text-ink-primary">Runtime environments:</strong> Python 3.11+, Node.js LTS — tracked via endoflife.date. Must be on supported versions.</li>
            <li><strong className="text-ink-primary">Database:</strong> PostgreSQL 16 (supported through November 2028). Upgrade before EOL date.</li>
            <li><strong className="text-ink-primary">Docker base images:</strong> pinned to specific minor versions; reviewed monthly for EOL status.</li>
            <li><strong className="text-ink-primary">Python packages:</strong> <code className="text-honey text-[11px]">pip-audit</code> run quarterly.</li>
            <li><strong className="text-ink-primary">OS (Ubuntu):</strong> LTS releases only; upgraded before standard support ends.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "privacy-policy",
      title: "Published Privacy Policy",
      icon: <Globe className="w-4 h-4 text-honey" />,
      attestation: "Attest that your organization has published a privacy policy",
      status: "implemented",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <p>
            A comprehensive privacy policy is published at{" "}
            <a href="/privacy" className="text-honey underline hover:opacity-80 transition-opacity">/privacy</a> and covers:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>What data is collected and from which sources</li>
            <li>How data is used and processed</li>
            <li>Data retention periods and deletion procedures</li>
            <li>Third-party services (Plaid, Anthropic, Ollama)</li>
            <li>User rights: access, deletion, portability, correction</li>
            <li>Security measures in place</li>
          </ul>
        </div>
      ),
    },
    {
      id: "data-retention",
      title: "Data Deletion & Retention Policy",
      icon: <Trash2 className="w-4 h-4 text-ink-tertiary" />,
      attestation: "Attest that your organization has implemented a data deletion and retention policy",
      status: "implemented",
      content: (
        <div className="space-y-3 text-[13px] text-ink-secondary">
          <div className="bg-elevated border border-white/[0.06] rounded-lg px-4 py-3 space-y-2">
            <p className="font-medium text-ink-primary">Retention Schedule</p>
            <table className="w-full text-[11px]">
              <tbody>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-1.5 text-ink-primary">Transaction data</td>
                  <td className="py-1.5 text-ink-secondary">24 months (configurable)</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-1.5 text-ink-primary">Audit logs</td>
                  <td className="py-1.5 text-ink-secondary">12 months</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-1.5 text-ink-primary">Budget history</td>
                  <td className="py-1.5 text-ink-secondary">Indefinite (for trend analysis)</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-ink-primary">Net worth snapshots</td>
                  <td className="py-1.5 text-ink-secondary">Indefinite</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="font-medium text-ink-primary mt-2">Request Data Deletion</p>
          <p>Permanently delete all financial data. This cannot be undone.</p>
          <form onSubmit={handlePurge} className="space-y-3 mt-2">
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Type "DELETE ALL MY DATA" to confirm'
              className="hive-input"
            />
            <button
              type="submit"
              disabled={deleteLoading || deleteConfirm !== "DELETE ALL MY DATA"}
              className="hive-btn-danger"
            >
              {deleteLoading ? "Deleting…" : "Delete all financial data"}
            </button>
          </form>
        </div>
      ),
    },
    {
      id: "isp",
      title: "Information Security Policy (ISP)",
      icon: <FileText className="w-4 h-4 text-ink-tertiary" />,
      attestation: "Attest that your organization has created an Information Security Policy (ISP)",
      status: "policy",
      content: (
        <div className="space-y-4 text-[13px] text-ink-secondary">
          <p className="font-semibold text-ink-primary">Information Security Policy — Hive Finance</p>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-ink-primary mb-1">Purpose</p>
              <p>To protect the confidentiality, integrity, and availability of personal financial data processed by Hive Finance, including data obtained through Plaid API integrations.</p>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Access Control</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>All access requires authentication via username/password + optional TOTP MFA</li>
                <li>Network access restricted to Tailscale VPN (zero-trust network)</li>
                <li>Principle of least privilege enforced via RBAC roles</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Data Protection</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>All data encrypted in transit via TLS 1.2+</li>
                <li>Plaid access tokens encrypted at rest (AES-256)</li>
                <li>Passwords stored as bcrypt hashes (minimum cost factor 12)</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "access-control-policy",
      title: "Access Control Policy",
      icon: <Lock className="w-4 h-4 text-ink-tertiary" />,
      attestation: "Attest that your organization has implemented a defined and documented access control policy",
      status: "implemented",
      content: (
        <div className="space-y-4 text-[13px] text-ink-secondary">
          <p className="font-semibold text-ink-primary">Access Control Policy — Hive Finance</p>
          <div className="space-y-3">
            <div>
              <p className="font-medium text-ink-primary mb-1">Authentication Requirements</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>All users must authenticate with username + password before accessing the application</li>
                <li>Passwords must be at least 12 characters; stored as bcrypt hashes</li>
                <li>TOTP MFA is strongly recommended and required for Plaid compliance attestation</li>
                <li>Sessions expire after 12 hours; re-authentication required</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Network Access Control</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Application accessible only via Tailscale VPN (no public internet exposure)</li>
                <li>All backend services bind to 127.0.0.1 (localhost only)</li>
                <li>Database and Redis not exposed outside the host machine</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const implementedCount = policies.filter((p) => p.status === "implemented").length;
  const partialCount = policies.filter((p) => p.status === "partial").length;

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      <div>
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-lg bg-honey/[0.08] border border-honey/[0.14] flex items-center justify-center">
            <Shield className="w-4 h-4 text-honey" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Security &amp; Compliance</h1>
        </div>
        <p className="text-[13px] text-ink-tertiary">
          Plaid attestation requirements and security policies for Hive Finance
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="hive-card p-4 text-center">
          <p className="text-[24px] font-bold text-semantic-income hive-number">{implementedCount}</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">Implemented</p>
        </div>
        <div className="hive-card p-4 text-center">
          <p className="text-[24px] font-bold text-honey hive-number">{partialCount}</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">Partial</p>
        </div>
        <div className="hive-card p-4 text-center">
          <p className="text-[24px] font-bold text-ink-secondary hive-number">{policies.length - implementedCount - partialCount}</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">Policy Only</p>
        </div>
      </div>

      {/* Policy sections */}
      <div className="space-y-2">
        {policies.map((policy) => (
          <div key={policy.id} className="hive-card overflow-hidden">
            <button
              onClick={() => toggle(policy.id)}
              className="w-full flex items-start gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="mt-0.5 shrink-0">{policy.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-primary">{policy.title}</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5 leading-relaxed">{policy.attestation}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {statusBadge(policy.status)}
                {expanded.has(policy.id)
                  ? <ChevronUp className="w-4 h-4 text-ink-tertiary" />
                  : <ChevronDown className="w-4 h-4 text-ink-tertiary" />
                }
              </div>
            </button>
            {expanded.has(policy.id) && (
              <div className="border-t border-white/[0.05] px-5 py-4">
                {policy.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
