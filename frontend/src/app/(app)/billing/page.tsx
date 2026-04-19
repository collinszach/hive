"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Building2,
  ArrowRight,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { authedFetch } from "@/lib/auth";
import { GlassCard } from "@/components/GlassCard";
import Link from "next/link";

interface BillingStatus {
  plan: "free" | "starter" | "pro";
  role: "admin" | "viewer";
  stripe_status: string | null;
  period_end: string | null;
  plaid_used: number;
  plaid_limit: number | null;
}

const PLAN_LABELS: Record<BillingStatus["plan"], string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

const PLAN_COLORS: Record<BillingStatus["plan"], string> = {
  free:    "rgba(122,114,104,0.15)",
  starter: "rgba(56,189,248,0.12)",
  pro:     "rgba(245,185,66,0.12)",
};

const PLAN_TEXT: Record<BillingStatus["plan"], string> = {
  free:    "text-ink-tertiary",
  starter: "text-sky-400",
  pro:     "text-honey",
};

export default function BillingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    authedFetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: BillingStatus) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await authedFetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      if (!res.ok) { setPortalLoading(false); return; }
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      setPortalLoading(false);
    }
  }

  const isPastDue = status?.stripe_status === "past_due";
  const isCanceled = status?.stripe_status === "canceled";
  const hasBilling = status?.plan !== "free";

  return (
    <div className="space-y-5 max-w-xl animate-fade-in">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Billing</h1>
        <p className="text-[13px] text-ink-tertiary mt-0.5">Manage your subscription and connections</p>
      </div>

      {/* Past-due alert */}
      {isPastDue && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <AlertTriangle className="w-4 h-4 text-semantic-expense shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-semantic-expense">Payment past due</p>
            <p className="text-[12px] text-semantic-expense/70 mt-0.5">
              Update your payment method to keep your bank connections active.
            </p>
          </div>
          <button
            onClick={handleManageBilling}
            className="shrink-0 text-[12px] font-semibold text-semantic-expense border border-semantic-expense/30
                       px-3 py-1.5 rounded-lg hover:bg-semantic-expense/10 transition-colors"
          >
            Fix now
          </button>
        </div>
      )}

      {/* Current plan */}
      {loading ? (
        <GlassCard className="p-5 space-y-4 animate-pulse">
          <div className="h-3 bg-white/[0.06] rounded w-20" />
          <div className="h-8 bg-white/[0.08] rounded w-32" />
          <div className="h-3 bg-white/[0.04] rounded w-48" />
        </GlassCard>
      ) : status && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2.5 mb-5">
            <CreditCard className="w-4 h-4 text-ink-tertiary" />
            <h2 className="text-[13px] font-semibold text-ink-primary">Current Plan</h2>
          </div>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[24px] font-bold ${PLAN_TEXT[status.plan]}`}
                >
                  {PLAN_LABELS[status.plan]}
                </span>
                {status.role === "admin" && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-honey"
                    style={{ background: "rgba(245,185,66,0.12)", border: "1px solid rgba(245,185,66,0.2)" }}
                  >
                    ADMIN
                  </span>
                )}
              </div>
              {status.stripe_status && !isPastDue && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-semantic-income" />
                  <span className="text-[12px] text-semantic-income capitalize">{status.stripe_status}</span>
                </div>
              )}
              {isCanceled && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-semantic-warning" />
                  <span className="text-[12px] text-semantic-warning">Canceled</span>
                </div>
              )}
            </div>

            <div
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: PLAN_COLORS[status.plan], border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className={PLAN_TEXT[status.plan]}>{PLAN_LABELS[status.plan]} Plan</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Plaid connections */}
            <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5 text-ink-tertiary" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Connections</p>
              </div>
              <p className="text-[20px] font-semibold font-mono text-ink-primary">
                {status.plaid_used}
                <span className="text-[14px] text-ink-tertiary">
                  {" "}/ {status.plaid_limit === null ? "∞" : status.plaid_limit}
                </span>
              </p>
              {status.plaid_limit !== null && (
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((status.plaid_used / status.plaid_limit) * 100, 100)}%`,
                      background: status.plaid_used >= status.plaid_limit
                        ? "linear-gradient(90deg, #F87171, #EF4444)"
                        : "linear-gradient(90deg, #34D399, #10B981)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Period end */}
            {status.period_end && (
              <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-ink-tertiary" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">
                    {isCanceled ? "Access until" : "Renews"}
                  </p>
                </div>
                <p className="text-[14px] font-semibold text-ink-primary">
                  {new Date(status.period_end).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {hasBilling && (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium
                           text-ink-primary hover:bg-white/[0.06] border border-white/[0.08]
                           transition-all duration-150 disabled:opacity-60"
              >
                {portalLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    Opening…
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    Manage Billing
                  </>
                )}
              </button>
            )}
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium
                         text-honey hover:bg-honey/[0.07] border border-honey/20
                         transition-all duration-150"
            >
              {status.plan === "free" ? "Upgrade plan" : "Change plan"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </GlassCard>
      )}

      {/* Free plan upgrade CTA */}
      {!loading && status?.plan === "free" && (
        <GlassCard tint="amber" className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(245,185,66,0.12)", border: "1px solid rgba(245,185,66,0.2)" }}
            >
              <Building2 className="w-5 h-5 text-honey" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-ink-primary mb-1">
                Connect your real bank accounts
              </p>
              <p className="text-[12px] text-ink-secondary mb-4 leading-relaxed">
                Upgrade to Starter ($9/mo) to link up to 3 bank accounts and credit cards
                with automatic daily transaction sync.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                           text-[13px] font-semibold text-[#0A0C10] transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)" }}
              >
                See Plans
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
