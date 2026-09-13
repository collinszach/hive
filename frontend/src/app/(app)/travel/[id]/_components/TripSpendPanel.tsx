"use client";

import { useEffect, useState, useCallback } from "react";
import { Link2, Unlink, Wallet, AlertTriangle, Check } from "lucide-react";
import { api, TripSpend, TripAffordability, LinkedTransaction } from "@/lib/api";
import { fmt, fmtDate, cn } from "@/lib/utils";
import { toast } from "@/components/Toast";

/**
 * Planned against actual, and whether the trip can be paid for.
 *
 * Both are cash comparisons. An award's cash cost is its fees, not the value of the
 * points it burns — charging a baseline valuation against a bank balance would
 * overstate what the trip actually costs to fund. Points are reported separately.
 */
export function TripSpendPanel({ tripId }: { tripId: string }) {
  const [spend, setSpend] = useState<TripSpend | null>(null);
  const [afford, setAfford] = useState<TripAffordability | null>(null);
  const [suggested, setSuggested] = useState<LinkedTransaction[]>([]);
  const [showSuggested, setShowSuggested] = useState(false);

  const load = useCallback(async () => {
    const [s, a, sug] = await Promise.allSettled([
      api.travel.spend(tripId),
      api.travel.affordability(tripId),
      api.travel.suggestedTransactions(tripId),
    ]);
    if (s.status === "fulfilled") setSpend(s.value);
    if (a.status === "fulfilled") setAfford(a.value);
    setSuggested(sug.status === "fulfilled" ? sug.value : []);
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  async function link(txId: string) {
    try { await api.travel.linkTransaction(tripId, txId); load(); }
    catch { toast.error("Failed to attach"); }
  }
  async function unlink(txId: string) {
    try { await api.travel.unlinkTransaction(tripId, txId); load(); }
    catch { toast.error("Failed to detach"); }
  }

  if (!spend && !afford) return null;

  const over = spend && spend.variance > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Can I pay for it ── */}
      {afford && (
        <div className="hive-card p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-honey" />
            <p className="text-[13px] font-medium text-ink-primary">Can you pay for it</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-mono text-ink-primary tabular-nums">
              {fmt(afford.cash_needed)}
            </span>
            <span className="text-[11px] text-ink-tertiary">cash needed</span>
          </div>
          <p className={cn("text-[12px]", afford.affordable ? "text-semantic-income" : "text-semantic-expense")}>
            {afford.summary}
          </p>
          {afford.monthly_to_save !== null && (
            <p className="text-[11px] text-ink-tertiary">
              {fmt(afford.monthly_to_save)}/month to close the gap before you go
              {afford.days_until !== null && ` (${afford.days_until} days)`}.
            </p>
          )}

          {Object.keys(afford.points_needed).length > 0 && (
            <div className="pt-1 space-y-1">
              {Object.entries(afford.points_needed).map(([program, needed]) => {
                const short = afford.points_shortfalls[program];
                return (
                  <div key={program} className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-tertiary">{program}</span>
                    <span className={cn("font-mono tabular-nums", short ? "text-semantic-expense" : "text-semantic-income")}>
                      {Math.round(needed).toLocaleString()} needed
                      {short ? ` · ${Math.round(short).toLocaleString()} short` : " · covered"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-ink-ghost pt-1 leading-snug">
            Cash is measured against liquid position, not this month&apos;s safe-to-spend —
            a trip months out is a saving question. An award&apos;s cash cost is its fees.
          </p>
        </div>
      )}

      {/* ── Planned vs actual ── */}
      {spend && (
        <div className="hive-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink-primary">Planned vs actual</p>
            {suggested.length > 0 && (
              <button
                onClick={() => setShowSuggested((v) => !v)}
                className="text-[11px] text-honey hover:opacity-80"
              >
                {showSuggested ? "Hide" : `${suggested.length} to attach`}
              </button>
            )}
          </div>

          {!spend.has_plan && (
            <p className="text-[11px] text-ink-tertiary">
              Nothing costed yet — choose an option on a leg to set the plan.
            </p>
          )}

          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-[10px] text-ink-tertiary uppercase tracking-wider">Planned</p>
              <p className="text-[17px] font-mono text-ink-secondary tabular-nums">{fmt(spend.planned_cash)}</p>
            </div>
            <div>
              <p className="text-[10px] text-ink-tertiary uppercase tracking-wider">Actual</p>
              <p className="text-[17px] font-mono text-ink-primary tabular-nums">{fmt(spend.actual_cash)}</p>
            </div>
            {spend.has_plan && spend.actual_cash > 0 && (
              <div>
                <p className="text-[10px] text-ink-tertiary uppercase tracking-wider">
                  {over ? "Over" : "Under"}
                </p>
                <p className={cn("text-[17px] font-mono tabular-nums",
                                 over ? "text-semantic-expense" : "text-semantic-income")}>
                  {fmt(Math.abs(spend.variance))}
                </p>
              </div>
            )}
          </div>

          {showSuggested && suggested.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[10px] text-ink-tertiary">
                Travel charges near these dates. Attach the ones that are really this trip.
              </p>
              {suggested.map((t) => (
                <div key={t.transaction_id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.03]">
                  <span className="flex-1 min-w-0 text-[11px] text-ink-secondary truncate">
                    {t.merchant} · {fmtDate(t.date)}
                  </span>
                  <span className="text-[11px] font-mono text-ink-primary tabular-nums">{fmt(t.amount)}</span>
                  <button onClick={() => link(t.transaction_id)} title="Attach to this trip"
                          className="p-1 rounded text-ink-ghost hover:text-semantic-income">
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {spend.transactions.length > 0 && (
            <div className="space-y-1 pt-1">
              {spend.transactions.map((t) => (
                <div key={t.transaction_id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02] group">
                  <Check className="w-3 h-3 text-semantic-income shrink-0" />
                  <span className="flex-1 min-w-0 text-[11px] text-ink-secondary truncate">
                    {t.merchant} · {fmtDate(t.date)}
                  </span>
                  <span className="text-[11px] font-mono text-ink-primary tabular-nums">{fmt(t.amount)}</span>
                  <button onClick={() => unlink(t.transaction_id)} title="Detach"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-ghost hover:text-semantic-expense transition-all">
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {spend.transactions.length === 0 && !showSuggested && (
            <p className="text-[11px] text-ink-tertiary">
              No transactions attached yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
