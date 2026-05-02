"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  MonthlyPosition,
  CardPaymentInfo,
  PendingReimbursement,
  SubscriptionPending,
  ExpenseShare,
} from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/GlassCard";
import { PageHero } from "@/components/PageHero";
import { toast } from "@/components/Toast";
import {
  CreditCard,
  Repeat2,
  Users,
  Check,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { MonthPicker } from "@/components/MonthPicker";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dueBadge(days: number, autopay: boolean): { label: string; color: string } {
  // Autopay cards that are past-due were already paid automatically
  if (autopay && days < 0) return { label: "Paid", color: "text-semantic-income bg-semantic-income/10" };
  if (days < 0) return { label: "Overdue", color: "text-semantic-expense bg-semantic-expense/10" };
  if (days === 0) return { label: autopay ? "Auto-paying" : "Due today", color: "text-semantic-expense bg-semantic-expense/10" };
  if (days <= 7) return { label: autopay ? `Auto-pay ${days}d` : `${days}d`, color: "text-honey bg-honey/10" };
  // Autopay cards with payment far out don't need attention — just confirm auto-pay is on
  if (autopay) return { label: "Auto-pay", color: "text-semantic-income bg-semantic-income/10" };
  return { label: `${days}d`, color: "text-ink-tertiary bg-white/[0.04]" };
}

export default function PositionPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<MonthlyPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [settledShares, setSettledShares] = useState<ExpenseShare[]>([]);
  const [showSettled, setShowSettled] = useState(false);
  const [unsettling, setUnsettling] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.position.monthly(month)
      .then(setData)
      .catch(() => toast.error("Failed to load position"))
      .finally(() => setLoading(false));
  }, [month]);

  async function handleSettle(shareId: string) {
    setSettling(shareId);
    try {
      await api.shares.settle(shareId);
      toast.success("Marked as settled");
      const [fresh, settled] = await Promise.all([
        api.position.monthly(month),
        api.shares.settled(20),
      ]);
      setData(fresh);
      setSettledShares(settled);
    } catch {
      toast.error("Failed to settle share");
    } finally {
      setSettling(null);
    }
  }

  async function handleUnsettle(shareId: string) {
    setUnsettling(shareId);
    try {
      await api.shares.unsettle(shareId);
      toast.success("Marked as pending");
      const [fresh, settled] = await Promise.all([
        api.position.monthly(month),
        api.shares.settled(20),
      ]);
      setData(fresh);
      setSettledShares(settled);
    } catch {
      toast.error("Failed to unsettle share");
    } finally {
      setUnsettling(null);
    }
  }

  // Load settled shares
  useEffect(() => {
    api.shares.settled(20).then(setSettledShares).catch(() => {});
  }, []);

  const isCurrentMonth = month === currentMonth();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow={`Monthly Position · ${monthLabel(month)}`}
            headline={
              loading ? (
                <span className="text-ink-ghost">Loading…</span>
              ) : data ? (
                <>
                  <span className={cn(
                    "font-mono",
                    data.remaining_to_save > 0 ? "text-semantic-income" : "text-semantic-expense"
                  )}>
                    {fmt(data.remaining_to_save)}
                  </span>
                  {" "}
                  <span className="text-ink-secondary text-[18px] font-normal">
                    {data.remaining_to_save > 0 ? "left to move to savings" : "over budget"}
                  </span>
                </>
              ) : (
                <span className="text-ink-ghost">No data</span>
              )
            }
            subtext={data ? `${fmt(data.saved)} already moved to savings · ${fmt(data.available_to_save)} total surplus` : "income · spending · savings · commitments · reimbursements"}
            glow="blue"
            statStrip={data ? [
              { label: "Income",            value: fmt(data.income),                             color: "green"   },
              { label: "Spent",             value: fmt(data.spent),                              color: "red"     },
              { label: "Moved to savings",  value: fmt(data.saved),                              color: "green"   },
              { label: "Subscriptions due", value: fmt(data.subscriptions_pending_total),         color: "default" },
              { label: "Owed to you",       value: `+${fmt(data.pending_reimbursements_total)}`, color: "green"   },
            ] : undefined}
          />
        </div>
        <MonthPicker
          month={month}
          onChange={setMonth}
          maxMonth={currentMonth()}
          className="mt-2 shrink-0"
        />
      </div>

      {loading && (
        <GlassCard className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</GlassCard>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Card Payments ── */}
          <GlassCard className="overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-ink-ghost" />
              <p className="text-[13px] font-medium text-ink-primary">Card Payments</p>
              <span className="ml-auto text-[11px] text-ink-ghost">{data.card_payments.length} cards</span>
            </div>

            {data.card_payments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-ink-tertiary mb-1">No billing dates configured</p>
                <button
                  onClick={() => router.push("/settings?tab=cards")}
                  className="text-[11px] text-honey hover:text-honey/80 transition-colors"
                >
                  Set up billing dates →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {data.card_payments.map((card: CardPaymentInfo) => {
                  const badge = dueBadge(card.days_until_due, card.autopay);
                  return (
                    <div key={card.account_id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-ink-primary truncate">{card.account_name}</p>
                        <p className="text-[11px] text-ink-ghost">
                          Closes {card.statement_close_day} · Due {card.payment_due_day}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                        badge.color
                      )}>
                        {badge.label}
                      </span>
                      <p className="text-[14px] font-mono font-semibold text-ink-primary tabular-nums w-24 text-right shrink-0">
                        {fmt(card.statement_balance)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* ── Subscriptions Pending ── */}
          <GlassCard className="overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <Repeat2 className="w-4 h-4 text-ink-ghost" />
              <p className="text-[13px] font-medium text-ink-primary">Subscriptions Pending</p>
              <span className="ml-auto text-[11px] text-ink-ghost">
                {fmt(data.subscriptions_pending_total)} total
              </span>
            </div>

            {data.subscriptions_pending.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-ink-tertiary">All subscriptions charged for the month</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {data.subscriptions_pending.map((sub: SubscriptionPending) => (
                  <div key={sub.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-ink-primary truncate">{sub.merchant_name}</p>
                      <p className="text-[11px] text-ink-ghost capitalize">
                        {sub.frequency}
                        {sub.next_expected ? ` · expected ${sub.next_expected}` : ""}
                      </p>
                    </div>
                    <p className="text-[14px] font-mono font-semibold text-ink-primary tabular-nums w-20 text-right shrink-0">
                      {fmt(sub.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* ── Pending Reimbursements ── */}
          <GlassCard className="overflow-hidden lg:col-span-2">
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <Users className="w-4 h-4 text-ink-ghost" />
              <p className="text-[13px] font-medium text-ink-primary">Pending Reimbursements</p>
              {data.pending_reimbursements.length > 0 && (
                <span className="text-[11px] text-semantic-income bg-semantic-income/10 px-1.5 py-0.5 rounded ml-1">
                  +{fmt(data.pending_reimbursements_total)} owed to you
                </span>
              )}
            </div>

            {data.pending_reimbursements.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-ink-tertiary">No pending reimbursements — everyone&apos;s paid up</p>
                <p className="text-[11px] text-ink-ghost mt-1">
                  Share expenses from any transaction in the drawer
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {data.pending_reimbursements.map((r: PendingReimbursement) => (
                  <div key={r.share_id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-ink-primary">{r.contact_name}</p>
                        {r.days_outstanding > 14 && (
                          <AlertTriangle className="w-3 h-3 text-honey shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-ink-ghost truncate">
                        {r.transaction_merchant ?? "Unknown merchant"} · {r.transaction_date}
                        {r.note ? ` · ${r.note}` : ""}
                        {r.days_outstanding > 0 ? ` · ${r.days_outstanding}d ago` : ""}
                      </p>
                    </div>
                    <p className="text-[14px] font-mono font-semibold text-semantic-income tabular-nums w-20 text-right shrink-0">
                      +{fmt(r.amount)}
                    </p>
                    <button
                      onClick={() => handleSettle(r.share_id)}
                      disabled={settling === r.share_id}
                      className="shrink-0 flex items-center gap-1 text-[11px] text-ink-ghost hover:text-semantic-income border border-white/[0.08] hover:border-semantic-income/30 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Settled
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* ── Settled Reimbursements ── */}
          {settledShares.length > 0 && (
            <GlassCard className="overflow-hidden lg:col-span-2">
              <button
                onClick={() => setShowSettled(s => !s)}
                className="w-full px-5 py-3 border-b border-white/[0.04] flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-ink-ghost" />
                <p className="text-[13px] font-medium text-ink-primary">Recently Settled</p>
                <span className="text-[11px] text-ink-ghost ml-1">({settledShares.length})</span>
                <ChevronDown className={cn(
                  "w-3.5 h-3.5 text-ink-ghost ml-auto transition-transform",
                  showSettled && "rotate-180"
                )} />
              </button>

              {showSettled && (
                <div className="divide-y divide-white/[0.04]">
                  {settledShares.map((s) => (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-ink-primary">{s.contact_name}</p>
                        <p className="text-[11px] text-ink-ghost truncate">
                          {s.transaction_merchant ?? "Unknown merchant"}
                          {s.transaction_date ? ` · ${s.transaction_date}` : ""}
                          {s.note ? ` · ${s.note}` : ""}
                          {s.settled_at ? ` · settled ${new Date(s.settled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                        </p>
                      </div>
                      <p className="text-[14px] font-mono text-ink-tertiary tabular-nums w-20 text-right shrink-0">
                        {fmt(s.amount)}
                      </p>
                      <button
                        onClick={() => handleUnsettle(s.id)}
                        disabled={unsettling === s.id}
                        className="shrink-0 flex items-center gap-1 text-[11px] text-ink-ghost hover:text-honey border border-white/[0.08] hover:border-honey/30 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Unsettle
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
