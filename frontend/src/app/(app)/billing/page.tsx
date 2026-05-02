"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHero";

interface BillingStatus {
  plan: "free" | "starter" | "pro";
  stripe_status: string | null;
  period_end: string | null;
  plaid_used: number;
  plaid_limit: number;
  claude_enabled: boolean;
  snaptrade_enabled: boolean;
}

const PLANS = [
  {
    key: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Manual accounts (unlimited)",
      "Budgets & analytics",
      "Ollama AI categorization",
      "Anomaly detection",
      "Forecasting",
      "Points tracking",
      "Tax export",
    ],
    missing: ["Plaid bank sync", "Claude AI chat", "SnapTrade investments"],
  },
  {
    key: "starter" as const,
    name: "Starter",
    price: "$9",
    period: "/mo",
    features: [
      "Everything in Free",
      "Plaid bank sync (up to 3 accounts)",
      "Daily automatic sync",
    ],
    missing: ["Claude AI chat", "SnapTrade investments"],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$19",
    period: "/mo",
    badge: "MOST POPULAR",
    features: [
      "Everything in Starter",
      "Up to 10 Plaid accounts",
      "Claude Sonnet AI chat",
      "SnapTrade investment accounts",
      "Priority support",
    ],
    missing: [] as string[],
  },
];

// Separated so useSearchParams can be wrapped in Suspense
function SuccessToast() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Welcome to your new plan.");
    }
  }, [searchParams]);
  return null;
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load billing status");
        return r.json();
      })
      .then(setStatus)
      .catch(() => toast.error("Failed to load billing status"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout(plan: string) {
    setActionLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail ?? "Failed to start checkout"); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePortal() {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail ?? "Failed to open billing portal"); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div className="p-6 text-ink-secondary text-sm">Loading...</div>;

  const planLabel = status?.plan === "pro" ? "Pro Plan" : status?.plan === "starter" ? "Starter Plan" : "Free Plan";

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Suspense><SuccessToast /></Suspense>
      <PageHeader
        title={planLabel}
        subtitle="Manage your subscription and feature access"
      />

      {status?.stripe_status && (
        <div className="hive-card-featured p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-ink-secondary text-xs uppercase tracking-[0.06em] mb-1">Current Subscription</p>
            <p className="text-ink-primary font-semibold capitalize">
              {status.plan} ·{" "}
              <span className={
                status.stripe_status === "active" ? "text-semantic-income" :
                status.stripe_status === "past_due" ? "text-semantic-expense" : "text-semantic-warning"
              }>
                {status.stripe_status}
              </span>
            </p>
            {status.period_end && (
              <p className="text-ink-tertiary text-xs mt-1">
                Renews {new Date(status.period_end).toLocaleDateString()}
              </p>
            )}
          </div>
          <button onClick={handlePortal} disabled={actionLoading === "portal"} className="hive-btn-secondary text-sm shrink-0">
            {actionLoading === "portal" ? "Loading..." : "Manage Billing →"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = status?.plan === plan.key;
          return (
            <div key={plan.key} className={isCurrent ? "hive-card-hero p-5" : "hive-card p-5"}>
              {plan.badge && (
                <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.08em] bg-blue-faint text-blue px-2 py-0.5 rounded mb-3">
                  {plan.badge}
                </span>
              )}
              <p className="text-ink-primary font-semibold text-base mb-0.5">{plan.name}</p>
              <p className="font-mono text-2xl font-bold text-ink-primary mb-4">
                {plan.price}
                <span className="text-ink-tertiary text-sm font-normal">{plan.period}</span>
              </p>
              <ul className="space-y-2 mb-5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-ink-secondary">
                    <span className="text-semantic-income shrink-0">✓</span>{f}
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className="flex gap-2 text-ink-ghost">
                    <span className="shrink-0">✗</span>{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button disabled className="hive-btn-secondary w-full opacity-50 text-sm">Current Plan</button>
              ) : plan.key === "free" ? (
                <button disabled className="hive-btn-ghost w-full text-sm opacity-40">Downgrade</button>
              ) : (
                <button onClick={() => handleCheckout(plan.key)} disabled={!!actionLoading} className="hive-btn-primary w-full text-sm">
                  {actionLoading === plan.key ? "Loading..." : `Upgrade to ${plan.name} →`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
