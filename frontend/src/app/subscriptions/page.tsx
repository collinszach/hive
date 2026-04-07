"use client";

import { useEffect, useState } from "react";
import { api, Subscription, SubscriptionSummary } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Repeat2, AlertTriangle, X } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const FREQ_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

function annualCost(sub: Subscription): number {
  return sub.annual_cost ?? sub.amount * (FREQ_MULTIPLIER[sub.frequency] ?? 12);
}

export default function SubscriptionsPage() {
  const [data, setData]             = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    api.subscriptions.list(true).then(setData).finally(() => setLoading(false));
  }, []);

  async function handleCancel(id: string) {
    setCancelling(id);
    try {
      await api.subscriptions.update(id, { is_cancelled: true, is_active: false });
      const refreshed = await api.subscriptions.list(true);
      setData(refreshed);
    } finally {
      setCancelling(null);
    }
  }

  const subs = data?.subscriptions ?? [];
  const priceAlerts = subs.filter((s) => s.previous_amount !== null);
  const monthlyTotal = data?.total_monthly_cost ?? 0;
  const annualTotal  = data?.total_annual_cost ?? 0;
  const count        = data?.count ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* PageHero */}
      <PageHero
        eyebrow="Subscriptions"
        headline={
          <>
            <span className="text-honey">{fmt(monthlyTotal)}</span>/mo
          </>
        }
        subtext="detected recurring charges"
        glowColor="coral"
        statStrip={[
          { label: "Monthly", value: fmt(monthlyTotal), color: "amber" },
          { label: "Annual",  value: fmt(annualTotal),  color: "red"   },
          { label: "Active",  value: String(count),     color: "default" },
        ]}
      />

      {/* Total callout */}
      {data && (
        <GlassCard tint="amber" className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-ink-ghost mb-1">Monthly recurring</p>
              <p className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-primary tabular-nums font-mono">
                {fmt(monthlyTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-ink-ghost mb-1">Annual projection</p>
              <p className="text-[20px] font-semibold text-semantic-expense tabular-nums font-mono">
                {fmt(annualTotal)}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Price alerts */}
      {priceAlerts.length > 0 && (
        <GlassCard tint="expense" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-semantic-expense" />
            <p className="text-[13px] font-semibold text-semantic-expense">Price Changes Detected</p>
          </div>
          <div className="space-y-2">
            {priceAlerts.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-primary">{s.merchant_name}</span>
                <span className="font-mono text-ink-tertiary line-through">{fmt(s.previous_amount!)}</span>
                <span className="font-mono text-semantic-expense font-semibold">→ {fmt(s.amount)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Subscription list */}
      <GlassCard className="overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink-primary">Active Subscriptions</p>
          <p className="text-[11px] text-ink-tertiary">{subs.length} total</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center">
            <Repeat2 className="w-8 h-8 text-ink-tertiary/30 mx-auto mb-2" />
            <p className="text-[13px] text-ink-tertiary">No subscriptions detected yet.</p>
            <p className="text-[11px] text-ink-tertiary/60 mt-1">Run a sync to scan for recurring charges.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {subs.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center shrink-0">
                  <Repeat2 className="w-4 h-4 text-ink-tertiary" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-primary truncate">{sub.merchant_name}</p>
                  <p className="text-[11px] text-ink-tertiary">
                    {sub.category ?? "Unknown"} · {FREQ_LABELS[sub.frequency] ?? sub.frequency}
                    {sub.last_charged ? ` · Last: ${sub.last_charged}` : ""}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold font-mono text-ink-primary tabular-nums">
                    {fmt(sub.amount)}<span className="text-ink-tertiary text-[11px]">/{sub.frequency === "annual" ? "yr" : sub.frequency === "monthly" ? "mo" : sub.frequency === "weekly" ? "wk" : "qtr"}</span>
                  </p>
                  <p className="text-[11px] text-ink-tertiary font-mono">
                    {fmt(annualCost(sub))}/yr
                  </p>
                </div>

                {/* Cancel */}
                <button
                  onClick={() => handleCancel(sub.id)}
                  disabled={cancelling === sub.id}
                  className="ml-2 p-1.5 rounded-lg text-ink-tertiary hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors shrink-0 disabled:opacity-40"
                  title="Mark as cancelled"
                >
                  <X className="w-[14px] h-[14px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
