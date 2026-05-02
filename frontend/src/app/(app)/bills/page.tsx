"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, UpcomingBill, CardPaymentInfo, SubscriptionSummary } from "@/lib/api";
import { toast } from "@/components/Toast";
import { fmt, cn } from "@/lib/utils";
import { Calendar, Clock, CheckCircle2, AlertCircle, RefreshCw, Settings2, CreditCard, DollarSign } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dueBadge(days: number): { label: string; color: string } {
  if (days < 0) return { label: "Overdue", color: "text-semantic-expense bg-semantic-expense/10" };
  if (days === 0) return { label: "Due today", color: "text-semantic-expense bg-semantic-expense/10" };
  if (days <= 7) return { label: `${days}d`, color: "text-honey bg-honey/10" };
  return { label: `${days}d`, color: "text-ink-tertiary bg-white/[0.04]" };
}

const FREQ_LABEL: Record<string, string> = {
  weekly:    "Weekly",
  monthly:   "Monthly",
  quarterly: "Quarterly",
  annual:    "Annual",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway}d`;
}

function UrgencyDot({ bill }: { bill: UpcomingBill }) {
  if (bill.is_today)     return <span className="w-2 h-2 rounded-full bg-semantic-expense shrink-0" />;
  if (bill.is_this_week) return <span className="w-2 h-2 rounded-full bg-honey shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />;
}

function Section({
  title,
  icon,
  bills,
  tint = "none",
}: {
  title: string;
  icon: React.ReactNode;
  bills: UpcomingBill[];
  tint?: "expense" | "amber" | "none";
}) {
  const sectionTotal = bills.reduce((s, b) => s + b.amount, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em]">{title}</span>
          <span className="text-[10px] text-ink-ghost">({bills.length})</span>
        </div>
        <span className="text-[11px] font-mono text-ink-tertiary">{fmt(sectionTotal)}</span>
      </div>

      <GlassCard className="overflow-hidden" tint={tint}>
        <div className="divide-y divide-white/[0.04]">
          {bills.map((bill) => (
            <div key={bill.id} className="flex items-center gap-3 px-4 py-3">
              <UrgencyDot bill={bill} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-primary truncate">{bill.merchant_name}</p>
                <p className="text-[11px] text-ink-tertiary">
                  {FREQ_LABEL[bill.frequency] ?? bill.frequency}
                  {bill.category && ` · ${bill.category}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-semibold font-mono text-ink-primary tabular-nums">
                  {fmt(bill.amount)}
                </p>
                <p className={cn(
                  "text-[10px] font-medium mt-0.5",
                  bill.is_today ? "text-semantic-expense" : bill.is_this_week ? "text-honey" : "text-ink-ghost"
                )}>
                  {bill.next_expected ? `${formatDate(bill.next_expected)} · ${dayLabel(bill.days_away)}` : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export default function BillsPage() {
  const [bills, setBills]       = useState<UpcomingBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [window, setWindow]     = useState<30 | 60 | 90>(30);
  const [cards, setCards]       = useState<CardPaymentInfo[]>([]);
  const [summary, setSummary]   = useState<SubscriptionSummary | null>(null);

  useEffect(() => {
    setBillsLoading(true);
    api.subscriptions.upcoming(window)
      .then(setBills)
      .catch(() => toast.error("Failed to load upcoming bills"))
      .finally(() => setBillsLoading(false));
  }, [window]);

  useEffect(() => {
    api.position.monthly(currentMonth())
      .then((pos) => setCards(pos.card_payments))
      .catch(() => {});
    api.subscriptions.list()
      .then(setSummary)
      .catch(() => {});
  }, []);

  const today    = bills.filter((b) => b.is_today);
  const thisWeek = bills.filter((b) => !b.is_today && b.is_this_week);
  const later    = bills.filter((b) => !b.is_this_week);

  // Hero stats: use card due dates as the primary signal
  const cardsDueSoon = cards.filter((c) => c.days_until_due >= 0 && c.days_until_due <= 7).length;
  const totalCardBalance = cards.reduce((s, c) => s + (c.statement_balance ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow="Bills & Payments"
            headline={
              cardsDueSoon > 0
                ? <><span className="text-honey">{cardsDueSoon}</span> due this week</>
                : totalCardBalance > 0
                ? <><span className="text-ink-primary">{fmt(totalCardBalance)}</span> in balances</>
                : <span className="text-semantic-income">Nothing urgent</span>
            }
            subtext={summary ? `${fmt(summary.total_monthly_cost ?? 0)}/mo in recurring · ${summary.count} tracked` : "Credit card payments & recurring charges"}
            glow="red"
            glowColor={cardsDueSoon > 0 ? "amber" : "green"}
          />
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <div className="flex gap-1.5">
            {([30, 60, 90] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                  window === w
                    ? "bg-honey text-black"
                    : "bg-white/[0.04] border border-white/[0.08] text-ink-secondary hover:text-ink-primary"
                )}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Credit Card Billing Dates ─────────────────────────────────── */}
      {cards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-ink-tertiary" />
              <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em]">Credit Card Payments</span>
            </div>
            <Link
              href="/settings?tab=cards"
              className="text-[11px] text-ink-ghost hover:text-honey transition-colors no-underline"
            >
              Edit →
            </Link>
          </div>
          <GlassCard className="overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {cards.map((card) => {
                const badge = dueBadge(card.days_until_due);
                return (
                  <div key={card.account_id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-primary truncate">{card.account_name}</p>
                      <p className="text-[11px] text-ink-tertiary">
                        Statement closes day {card.statement_close_day} · Due day {card.payment_due_day}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums">{fmt(card.statement_balance)}</p>
                      <span className={cn(
                        "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5",
                        badge.color
                      )}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Monthly Recurring ─────────────────────────────────────────── */}
      {summary && summary.subscriptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-ink-tertiary" />
              <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em]">Recurring Charges</span>
              <span className="text-[10px] text-ink-ghost">({summary.count})</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-ink-ghost">{fmt(summary.total_annual_cost ?? 0)}/yr</span>
              <span className="text-[11px] font-mono text-ink-tertiary">{fmt(summary.total_monthly_cost ?? 0)}/mo</span>
            </div>
          </div>
          <GlassCard className="overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {summary.subscriptions
                .filter((s) => s.is_active && !s.is_cancelled)
                .sort((a, b) => b.amount - a.amount)
                .map((sub) => (
                  <div key={sub.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center shrink-0">
                      <DollarSign className="w-3.5 h-3.5 text-ink-ghost" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-primary truncate">{sub.merchant_name}</p>
                      <p className="text-[11px] text-ink-tertiary">
                        {FREQ_LABEL[sub.frequency] ?? sub.frequency}
                        {sub.category && ` · ${sub.category}`}
                        {sub.last_charged && ` · Last ${formatDate(sub.last_charged)}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums">{fmt(sub.amount)}</p>
                      {sub.price_changed_at && sub.previous_amount != null && (
                        <p className="text-[10px] text-honey mt-0.5">
                          was {fmt(sub.previous_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Upcoming bills (from next_expected dates) ─────────────────── */}
      {billsLoading && (
        <div className="py-8 text-center text-[13px] text-ink-tertiary animate-pulse">Loading…</div>
      )}

      {!billsLoading && bills.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="w-3.5 h-3.5 text-ink-tertiary" />
            <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em]">Upcoming in {window} days</span>
          </div>
          {today.length > 0 && (
            <Section title="Due Today" icon={<AlertCircle className="w-3.5 h-3.5 text-semantic-expense" />} bills={today} tint="expense" />
          )}
          {thisWeek.length > 0 && (
            <Section title="This Week" icon={<Clock className="w-3.5 h-3.5 text-honey" />} bills={thisWeek} tint="amber" />
          )}
          {later.length > 0 && (
            <Section title="Later" icon={<Calendar className="w-3.5 h-3.5 text-ink-tertiary" />} bills={later} />
          )}
        </div>
      )}

      {!billsLoading && bills.length === 0 && cards.length === 0 && (!summary || summary.count === 0) && (
        <GlassCard tint="income" className="py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-semantic-income/40 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-secondary">Nothing to show yet</p>
          <p className="text-[12px] text-ink-tertiary mt-1">
            Recurring charges are auto-detected from your transactions.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
