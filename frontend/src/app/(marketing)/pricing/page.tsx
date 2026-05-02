"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Building2,
  Zap,
  TrendingUp,
  Bot,
  Star,
  BarChart3,
  Shield,
  ArrowRight,
} from "lucide-react";
import { authedFetch } from "@/lib/auth";

// ── Plan data ────────────────────────────────────────────────────────────────

interface PlanFeature {
  text: string;
  highlight?: boolean;
}

interface Plan {
  id: "free" | "starter" | "pro";
  name: string;
  price: string;
  period: string;
  tagline: string;
  icon: React.ElementType;
  features: PlanFeature[];
  cta: string | null;  // null = no checkout button (free)
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "All local features, no bank connections",
    icon: Shield,
    cta: null,
    highlighted: false,
    features: [
      { text: "Manual account tracking" },
      { text: "Budgets & spending analytics" },
      { text: "Points optimizer (all 6 cards)" },
      { text: "Ollama AI categorization" },
      { text: "Ollama AI chat" },
      { text: "Forecasting & anomaly detection" },
      { text: "Tax calculator" },
      { text: "Net worth tracking" },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    period: "per month",
    tagline: "Real bank data with Plaid sync",
    icon: Building2,
    cta: "Get Started",
    highlighted: false,
    features: [
      { text: "Everything in Free" },
      { text: "Up to 3 Plaid bank connections", highlight: true },
      { text: "Real-time transaction sync" },
      { text: "Cursor-based incremental sync" },
      { text: "Automatic deduplication" },
      { text: "Daily sync schedule" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "per month",
    tagline: "Premium AI + investment tracking",
    icon: Star,
    cta: "Get Started",
    highlighted: true,
    features: [
      { text: "Everything in Starter" },
      { text: "Up to 10 Plaid connections", highlight: true },
      { text: "Claude AI categorization", highlight: true },
      { text: "Claude AI chat (Sonnet quality)" },
      { text: "Investment tracking via SnapTrade", highlight: true },
      { text: "Brokerage + retirement accounts" },
    ],
  },
];

// ── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({ text, highlight }: PlanFeature) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: highlight
            ? "rgba(245,185,66,0.15)"
            : "rgba(52,211,153,0.10)",
          border: `1px solid ${highlight ? "rgba(245,185,66,0.25)" : "rgba(52,211,153,0.15)"}`,
        }}
      >
        <Check className={`w-2.5 h-2.5 ${highlight ? "text-honey" : "text-semantic-income"}`} strokeWidth={2.5} />
      </div>
      <span className={`text-[13px] leading-snug ${highlight ? "text-ink-primary font-medium" : "text-ink-secondary"}`}>
        {text}
      </span>
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onCheckout, loading }: { plan: Plan; onCheckout: (id: string) => void; loading: string | null }) {
  const Icon = plan.icon;
  const isLoading = loading === plan.id;

  if (plan.highlighted) {
    return (
      <div
        className="relative rounded-2xl p-px overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(245,185,66,0.5) 0%, rgba(201,146,14,0.3) 50%, rgba(245,185,66,0.1) 100%)",
          boxShadow: "0 0 40px rgba(245,185,66,0.12), 0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Pro badge */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                     px-3 py-1 rounded-full text-[10px] font-bold tracking-wider"
          style={{
            background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
            color: "#0A0C10",
          }}
        >
          MOST POPULAR
        </div>
        <div
          className="h-full rounded-[15px] p-6 pt-8 flex flex-col"
          style={{
            background: "linear-gradient(145deg, rgba(245,185,66,0.07) 0%, #0F1117 40%)",
          }}
        >
          <PlanCardInner plan={plan} onCheckout={onCheckout} isLoading={isLoading} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-6 flex flex-col"
      style={{
        background: "#0F1117",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <PlanCardInner plan={plan} onCheckout={onCheckout} isLoading={isLoading} />
    </div>
  );
}

function PlanCardInner({
  plan,
  onCheckout,
  isLoading,
}: {
  plan: Plan;
  onCheckout: (id: string) => void;
  isLoading: boolean;
}) {
  const Icon = plan.icon;

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{
            background: plan.highlighted
              ? "rgba(245,185,66,0.12)"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${plan.highlighted ? "rgba(245,185,66,0.2)" : "rgba(255,255,255,0.07)"}`,
          }}
        >
          <Icon
            className={`w-5 h-5 ${plan.highlighted ? "text-honey" : "text-ink-tertiary"}`}
            strokeWidth={1.8}
          />
        </div>
        <h2 className="text-[17px] font-semibold text-ink-primary mb-0.5">{plan.name}</h2>
        <p className="text-[12px] text-ink-tertiary mb-4">{plan.tagline}</p>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[36px] font-bold tracking-tight"
            style={{ color: plan.highlighted ? "#F5B942" : "#F0F0F4" }}
          >
            {plan.price}
          </span>
          <span className="text-[13px] text-ink-tertiary">{plan.period}</span>
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-3 mb-6">
        {plan.features.map((f, i) => (
          <FeatureRow key={i} {...f} />
        ))}
      </div>

      {/* CTA */}
      {plan.cta ? (
        <button
          onClick={() => onCheckout(plan.id)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     text-[14px] font-semibold transition-all duration-150
                     disabled:opacity-60"
          style={
            plan.highlighted
              ? {
                  background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
                  color: "#0A0C10",
                  boxShadow: "0 4px 16px rgba(245,185,66,0.25)",
                }
              : {
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "#C8BFB4",
                }
          }
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              Redirecting…
            </span>
          ) : (
            <>
              {plan.cta}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <div
          className="w-full px-4 py-3 rounded-xl text-center text-[14px] text-ink-tertiary"
          style={{ border: "1px solid rgba(255,255,255,0.05)" }}
        >
          Current plan — always free
        </div>
      )}
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(planId: string) {
    setLoading(planId);
    try {
      const res = await authedFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          return_url: window.location.origin + "/billing",
        }),
      });

      if (!res.ok) {
        setLoading(null);
        return;
      }

      const data = await res.json() as { url?: string };
      if (data.url) {
        router.push(data.url);
      }
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-[30px] font-bold tracking-tight text-ink-primary mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-[15px] text-ink-secondary max-w-lg mx-auto">
          Start free with all local features. Add Plaid bank connections when you&apos;re ready for real data.
        </p>
      </div>

      {/* Feature overview strip */}
      <div
        className="grid grid-cols-3 gap-4 p-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        {[
          { icon: Bot, label: "AI-Powered", desc: "Ollama local AI + Claude premium" },
          { icon: BarChart3, label: "Full Analytics", desc: "Budgets, forecasting, net worth" },
          { icon: Shield, label: "Self-Hosted", desc: "Your data stays on your server" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 px-2">
            <Icon className="w-4 h-4 text-honey/60 shrink-0" strokeWidth={1.8} />
            <div>
              <p className="text-[12px] font-semibold text-ink-primary">{label}</p>
              <p className="text-[11px] text-ink-tertiary">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onCheckout={handleCheckout} loading={loading} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-[12px] text-ink-tertiary pb-4">
        All plans include unlimited local usage. Plaid connections enable real bank data sync.
        Cancel anytime — no long-term commitment.
      </p>
    </div>
  );
}
