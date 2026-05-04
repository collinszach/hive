"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "@/lib/api";
import { Info, X } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
}

type Strategy = "avalanche" | "snowball";

interface PayoffMonth {
  month: number;
  debts: { id: string; balance: number; payment: number; interest: number }[];
  totalBalance: number;
  totalInterest: number;
  totalPayment: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtExact(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function monthLabel(monthIndex: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthIndex, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ── Core payoff calculator ────────────────────────────────────────────────────

function runPayoff(debts: Debt[], extraPayment: number, strategy: Strategy): PayoffMonth[] {
  if (!debts.length) return [];

  // Work on mutable copies
  let state = debts.map((d) => ({ ...d, balance: d.balance }));
  const months: PayoffMonth[] = [];
  let monthNum = 0;

  while (state.some((d) => d.balance > 0.005) && monthNum < 600) {
    monthNum++;

    // Step 1: accrue interest
    state = state.map((d) => ({
      ...d,
      balance: d.balance > 0 ? d.balance * (1 + d.apr / 100 / 12) : 0,
    }));

    // Step 2: apply minimum payments
    let payments = state.map((d) => ({
      id: d.id,
      payment: Math.min(d.minPayment, d.balance),
    }));
    state = state.map((d) => {
      const p = payments.find((p) => p.id === d.id)!;
      return { ...d, balance: Math.max(0, d.balance - p.payment) };
    });

    // Step 3: order for extra payment based on strategy
    const open = state.filter((d) => d.balance > 0.005);
    const sorted =
      strategy === "avalanche"
        ? [...open].sort((a, b) => b.apr - a.apr)
        : [...open].sort((a, b) => a.balance - b.balance);

    let remaining = extraPayment;
    for (const target of sorted) {
      if (remaining <= 0) break;
      const pay = Math.min(remaining, target.balance);
      const idx = state.findIndex((d) => d.id === target.id);
      state[idx].balance = Math.max(0, state[idx].balance - pay);
      const pIdx = payments.findIndex((p) => p.id === target.id);
      payments[pIdx].payment += pay;
      remaining -= pay;
    }

    const totalBalance = state.reduce((s, d) => s + d.balance, 0);
    const totalInterest = state.reduce((s, d) => {
      const orig = debts.find((o) => o.id === d.id)!;
      return s + d.balance * (orig.apr / 100 / 12);
    }, 0);
    const totalPayment = payments.reduce((s, p) => s + p.payment, 0);

    months.push({
      month: monthNum,
      debts: state.map((d) => ({
        id: d.id,
        balance: d.balance,
        payment: payments.find((p) => p.id === d.id)?.payment ?? 0,
        interest: d.balance * (debts.find((o) => o.id === d.id)!.apr / 100 / 12),
      })),
      totalBalance,
      totalInterest,
      totalPayment,
    });
  }

  return months;
}

function totalInterestPaid(debts: Debt[], months: PayoffMonth[]): number {
  const totalPaid = months.reduce((s, m) => s + m.totalPayment, 0);
  const origBalance = debts.reduce((s, d) => s + d.balance, 0);
  return Math.max(0, totalPaid - origBalance);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DebtRow({
  debt,
  onChange,
  onRemove,
}: {
  debt: Debt;
  onChange: (updated: Debt) => void;
  onRemove: () => void;
}) {
  function field(key: keyof Debt, value: string) {
    const num = parseFloat(value);
    onChange({ ...debt, [key]: isNaN(num) ? 0 : num });
  }

  return (
    <div className="grid grid-cols-[1fr_100px_80px_100px_36px] gap-2 items-center">
      <input
        value={debt.name}
        onChange={(e) => onChange({ ...debt, name: e.target.value })}
        placeholder="e.g. Chase Visa"
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40 transition-colors"
      />
      <input
        type="number"
        min="0"
        step="100"
        value={debt.balance || ""}
        onChange={(e) => field("balance", e.target.value)}
        placeholder="Balance"
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40 transition-colors"
      />
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={debt.apr || ""}
        onChange={(e) => field("apr", e.target.value)}
        placeholder="APR %"
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40 transition-colors"
      />
      <input
        type="number"
        min="0"
        step="10"
        value={debt.minPayment || ""}
        onChange={(e) => field("minPayment", e.target.value)}
        placeholder="Min pmt"
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40 transition-colors"
      />
      <button
        onClick={onRemove}
        className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-ghost hover:text-red-400 hover:bg-red-500/10 transition-colors text-lg leading-none"
        aria-label="Remove"
      >
        ×
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DebtPage() {
  const [debts, setDebts] = useState<Debt[]>([
    { id: uid(), name: "", balance: 0, apr: 0, minPayment: 0 },
  ]);
  const [extraPayment, setExtraPayment] = useState<number>(0);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [showTable, setShowTable] = useState(false);
  const [prePopulated, setPrePopulated] = useState(false);

  // Auto-populate with linked credit card accounts on mount
  useEffect(() => {
    api.accounts.list().then((accounts) => {
      const creditCards = accounts.filter(
        (a) => a.type === "credit" && a.is_active && !a.is_excluded && (a.current_balance ?? 0) > 0
      );
      if (creditCards.length > 0) {
        setDebts(creditCards.map((a) => ({
          id: uid(),
          name: a.name,
          balance: a.current_balance ?? 0,
          apr: 0,
          minPayment: 0,
        })));
        setPrePopulated(true);
      }
    }).catch(() => {/* silently ignore — user can still enter manually */});
  }, []);

  const validDebts = debts.filter((d) => d.balance > 0 && d.minPayment > 0);

  const avalanche = useMemo(() => runPayoff(validDebts, extraPayment, "avalanche"), [validDebts, extraPayment]);
  const snowball = useMemo(() => runPayoff(validDebts, extraPayment, "snowball"), [validDebts, extraPayment]);

  const current = strategy === "avalanche" ? avalanche : snowball;
  const other = strategy === "avalanche" ? snowball : avalanche;

  const curInterest = totalInterestPaid(validDebts, current);
  const othInterest = totalInterestPaid(validDebts, other);
  const interestSaved = othInterest - curInterest;
  const monthsSaved = other.length - current.length;

  const totalBalance = validDebts.reduce((s, d) => s + d.balance, 0);
  const totalMin = validDebts.reduce((s, d) => s + d.minPayment, 0);

  function addDebt() {
    setDebts((prev) => [...prev, { id: uid(), name: "", balance: 0, apr: 0, minPayment: 0 }]);
  }

  function updateDebt(id: string, updated: Debt) {
    setDebts((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }

  function removeDebt(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }

  // Mini bar chart data: show last month of each quarter
  const chartMonths = current.filter((_, i) => i % 3 === 2 || i === current.length - 1).slice(0, 20);
  const maxBalance = totalBalance;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHero
        eyebrow="Debt Payoff Planner"
        headline={
          validDebts.length > 0 && current.length > 0
            ? <><span className="text-semantic-expense">{fmt(validDebts.reduce((s, d) => s + d.balance, 0))}</span> total</>
            : <span className="text-ink-secondary">Enter your debts</span>
        }
        subtext="Model avalanche vs snowball strategies and see your payoff timeline"
        statStrip={validDebts.length > 0 && current.length > 0 ? [
          { label: "Payoff",    value: monthLabel(current.length),        color: "green"   },
          { label: "Months",    value: String(current.length),            color: "default" },
          { label: "Interest",  value: fmt(curInterest),                  color: "red"     },
          { label: "Strategy",  value: strategy === "avalanche" ? "Avalanche" : "Snowball", color: "amber" },
        ] : undefined}
      />

      <div className="space-y-5">
        {/* ── Debt inputs ─────────────────────────────────────── */}
        <div className="hive-card p-5">
          <h2 className="text-[13px] font-semibold text-ink-primary mb-4">Your Debts</h2>

          {/* Pre-populated notice */}
          {prePopulated && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-honey/[0.06] border border-honey/[0.15] text-[12px] text-ink-secondary">
              <Info className="w-3.5 h-3.5 text-honey shrink-0" />
              <span className="flex-1">Pre-filled from your linked credit cards. Add APR and minimum payment to run the calculator.</span>
              <button onClick={() => setPrePopulated(false)} className="shrink-0 text-ink-ghost hover:text-ink-tertiary transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_80px_100px_36px] gap-2 mb-2">
            {["Name", "Balance ($)", "APR (%)", "Min Pmt ($)", ""].map((h) => (
              <p key={h} className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider px-1">
                {h}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            {debts.map((d) => (
              <DebtRow
                key={d.id}
                debt={d}
                onChange={(u) => updateDebt(d.id, u)}
                onRemove={() => removeDebt(d.id)}
              />
            ))}
          </div>

          <button
            onClick={addDebt}
            className="mt-3 flex items-center gap-1.5 text-[12px] text-honey hover:text-honey-bright transition-colors"
          >
            <span className="text-base leading-none">+</span> Add debt
          </button>
        </div>

        {/* ── Extra payment + strategy ─────────────────────────── */}
        <div className="hive-card p-5">
          <h2 className="text-[13px] font-semibold text-ink-primary mb-4">Payment Settings</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[12px] text-ink-secondary mb-1.5">
                Extra monthly payment (beyond minimums)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-tertiary">$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={extraPayment || ""}
                  onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-6 pr-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40 transition-colors"
                />
              </div>
              <p className="text-[11px] text-ink-ghost mt-1.5">
                Total monthly: <span className="font-mono">{fmt(totalMin + extraPayment)}</span>
              </p>
            </div>

            <div>
              <label className="block text-[12px] text-ink-secondary mb-1.5">Strategy</label>
              <div className="flex gap-2">
                {(["avalanche", "snowball"] as Strategy[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategy(s)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-[13px] font-semibold border transition-all duration-150 capitalize",
                      strategy === s
                        ? "bg-honey/[0.12] border-honey/25 text-honey"
                        : "bg-white/[0.03] border-white/[0.06] text-ink-secondary hover:text-ink-primary hover:bg-white/[0.06]"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-ghost mt-1.5">
                {strategy === "avalanche"
                  ? "Highest APR first — minimizes total interest paid"
                  : "Lowest balance first — builds momentum with quick wins"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Results ──────────────────────────────────────────── */}
        {validDebts.length > 0 && current.length > 0 && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Debt-free date",
                  value: monthLabel(current.length),
                  color: "text-semantic-income",
                },
                {
                  label: "Months to payoff",
                  value: `${current.length} mo`,
                  color: "text-ink-primary",
                },
                {
                  label: "Total interest",
                  value: fmt(curInterest),
                  color: "text-semantic-expense",
                },
                {
                  label: interestSaved >= 0 ? "vs snowball saves" : "vs avalanche saves",
                  value: interestSaved >= 0 ? fmt(interestSaved) : fmt(-interestSaved),
                  sub: monthsSaved !== 0
                    ? `${Math.abs(monthsSaved)} mo ${monthsSaved > 0 ? "sooner" : "later"}`
                    : "same timeline",
                  color: interestSaved >= 0 ? "text-semantic-income" : "text-honey",
                },
              ].map((k) => (
                <div key={k.label} className="hive-card px-4 py-4">
                  <p className="hive-label mb-1.5">{k.label}</p>
                  <p className={cn("text-[22px] font-bold font-mono tabular-nums", k.color)}>
                    {k.value}
                  </p>
                  {"sub" in k && k.sub && (
                    <p className="text-[11px] text-ink-ghost mt-0.5">{k.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Balance chart */}
            <div className="hive-card p-5">
              <h2 className="text-[13px] font-semibold text-ink-primary mb-4">Balance Over Time</h2>
              <div className="relative h-36 flex items-end gap-px">
                {/* Starting bar */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full rounded-sm bg-red-500/30"
                    style={{ height: `${(totalBalance / maxBalance) * 100}%` }}
                  />
                  <span className="text-[9px] text-ink-ghost">Now</span>
                </div>

                {chartMonths.map((m) => {
                  const pct = maxBalance > 0 ? (m.totalBalance / maxBalance) * 100 : 0;
                  return (
                    <div key={m.month} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={cn(
                          "w-full rounded-sm transition-all",
                          m.totalBalance < 0.01 ? "bg-emerald-500/40" : "bg-red-500/30"
                        )}
                        style={{ height: `${Math.max(pct, m.totalBalance < 0.01 ? 1 : 0)}%` }}
                      />
                      <span className="text-[9px] text-ink-ghost">{monthLabel(m.month)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-red-500/30" />
                  <span className="text-[11px] text-ink-tertiary">Balance remaining</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-emerald-500/40" />
                  <span className="text-[11px] text-ink-tertiary">Paid off</span>
                </div>
              </div>
            </div>

            {/* Per-debt payoff dates */}
            <div className="hive-card p-5">
              <h2 className="text-[13px] font-semibold text-ink-primary mb-4">Payoff Order</h2>
              <div className="space-y-3">
                {validDebts
                  .map((d) => {
                    const payoffMonth = current.find(
                      (m) => (m.debts.find((x) => x.id === d.id)?.balance ?? 1) < 0.01
                    );
                    const monthNum = payoffMonth?.month ?? current.length;
                    const paidFirst = strategy === "avalanche"
                      ? validDebts.sort((a, b) => b.apr - a.apr)[0]?.id === d.id
                      : validDebts.sort((a, b) => a.balance - b.balance)[0]?.id === d.id;
                    return { ...d, monthNum, paidFirst };
                  })
                  .sort((a, b) => a.monthNum - b.monthNum)
                  .map((d) => {
                    const pct = Math.min(100, (d.monthNum / current.length) * 100);
                    return (
                      <div key={d.id}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-ink-primary">
                              {d.name || "Unnamed"}
                            </span>
                            {d.paidFirst && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-honey/10 text-honey border border-honey/20">
                                Focus first
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] font-mono text-ink-secondary">
                            {monthLabel(d.monthNum)} · {fmtExact(d.balance)} @ {d.apr}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500/50 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Month-by-month table (collapsible) */}
            <div className="hive-card p-5">
              <button
                onClick={() => setShowTable((v) => !v)}
                className="flex items-center gap-2 w-full text-left"
              >
                <h2 className="text-[13px] font-semibold text-ink-primary">
                  Month-by-month schedule
                </h2>
                <span className="text-ink-ghost text-[11px] ml-auto">
                  {showTable ? "Hide" : "Show"} {current.length} months
                </span>
                <span className="text-ink-ghost text-[13px]">{showTable ? "▲" : "▼"}</span>
              </button>

              {showTable && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-2 pr-4 text-ink-tertiary font-medium">Month</th>
                        <th className="text-right py-2 pr-4 text-ink-tertiary font-medium">Payment</th>
                        <th className="text-right py-2 pr-4 text-ink-tertiary font-medium">Interest</th>
                        <th className="text-right py-2 text-ink-tertiary font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.map((m) => (
                        <tr
                          key={m.month}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-2 pr-4 text-ink-secondary font-mono">
                            {monthLabel(m.month)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-ink-primary">
                            {fmtExact(m.totalPayment)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-red-400/70">
                            {fmtExact(m.totalInterest)}
                          </td>
                          <td className={cn(
                            "py-2 text-right font-mono",
                            m.totalBalance < 0.01 ? "text-emerald-400" : "text-ink-primary"
                          )}>
                            {m.totalBalance < 0.01 ? "Paid off!" : fmtExact(m.totalBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {validDebts.length === 0 && (
          <div className="hive-card py-16 text-center">
            <p className="text-3xl mb-3">🎯</p>
            <p className="text-[14px] font-medium text-ink-secondary">Add your debts above to see your payoff plan</p>
            <p className="text-[12px] mt-1 text-ink-tertiary">Fill in balance, APR, and minimum payment for each account</p>
          </div>
        )}
      </div>
    </div>
  );
}
