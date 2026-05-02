"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, MonthlyReview, SpendByCategory } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHero } from "@/components/PageHero";
import { MonthPicker } from "@/components/MonthPicker";
import Link from "next/link";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReviewPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentYM());
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catThis, setCatThis] = useState<SpendByCategory[]>([]);
  const [catPrev, setCatPrev] = useState<SpendByCategory[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCatThis([]);
    setCatPrev([]);

    // Parse month boundaries
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const thisStart = `${month}-01`;
    const thisEnd   = `${month}-${String(lastDay).padStart(2, "0")}`;

    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;
    const prevLast = new Date(prevY, prevM, 0).getDate();
    const prevStart = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
    const prevEnd   = `${prevY}-${String(prevM).padStart(2, "0")}-${String(prevLast).padStart(2, "0")}`;

    Promise.allSettled([
      api.review.monthly(month),
      api.reports.spendingByCategory(thisStart, thisEnd),
      api.reports.spendingByCategory(prevStart, prevEnd),
    ])
      .then(([revR, catTR, catPR]) => {
        if (revR.status === "fulfilled") setReview(revR.value);
        else setError("Failed to load monthly review");
        if (catTR.status === "fulfilled") setCatThis(catTR.value);
        if (catPR.status === "fulfilled") setCatPrev(catPR.value);
      })
      .finally(() => setLoading(false));
  }, [month]);

  const atCurrentMonth = month >= currentYM();
  const net = review ? review.total_income - review.total_spend : 0;

  // Build category comparison chart data (excluding Transfers/Uncategorized, top 8 by this month)
  const catChartData = (() => {
    if (!catThis.length) return [];
    const thisMap: Record<string, number> = {};
    for (const r of catThis) {
      if (!r.subcategory && r.category !== "Transfers" && r.category !== "Uncategorized") {
        thisMap[r.category] = (thisMap[r.category] ?? 0) + r.total;
      }
    }
    const prevMap: Record<string, number> = {};
    for (const r of catPrev) {
      if (!r.subcategory && r.category !== "Transfers" && r.category !== "Uncategorized") {
        prevMap[r.category] = (prevMap[r.category] ?? 0) + r.total;
      }
    }
    const cats = Object.keys(thisMap).sort((a, b) => thisMap[b] - thisMap[a]).slice(0, 8);
    return cats.map((cat) => ({
      category: cat,
      "This Month": Math.round(thisMap[cat] ?? 0),
      "Last Month": Math.round(prevMap[cat] ?? 0),
    }));
  })();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow="Monthly Review"
            headline={
              loading ? (
                <span className="text-ink-tertiary">Loading…</span>
              ) : review ? (
                <>
                  <span className={net >= 0 ? "text-semantic-income" : "text-semantic-expense"}>
                    {net >= 0 ? "+" : ""}{fmt(net)}
                  </span>
                  <span className="text-ink-tertiary"> net</span>
                </>
              ) : (
                <span className="text-ink-tertiary">—</span>
              )
            }
            subtext={`Close the books — ${monthLabel(month)}`}
            statStrip={review && !loading ? [
              { label: "Income",  value: fmt(review.total_income),                                         color: "green"   },
              { label: "Spend",   value: fmt(review.total_spend),                                          color: "red"     },
              { label: "Txns",    value: String(review.transaction_count),                                 color: "default" },
              { label: "Budgets over", value: String(review.budget_categories_over),                      color: review.budget_categories_over > 0 ? "red" : "default" },
            ] : undefined}
          />
        </div>

        <MonthPicker month={month} onChange={setMonth} maxMonth={currentYM()} className="mt-2 shrink-0" />
      </div>

      {error && (
        <div className="hive-card p-4 text-[13px] text-semantic-expense">{error}</div>
      )}

      {loading && !error && (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="hive-card p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {review && !loading && (
        <div className="space-y-4">

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Net worth delta */}
            <div className="hive-card p-4 cursor-pointer hover:bg-white/[0.04] transition-colors" onClick={() => router.push("/net-worth")}>
              <p className="hive-label mb-2">Net Worth Δ</p>
              <p className={cn(
                "text-[22px] font-extrabold font-mono tracking-tight tabular-nums",
                review.net_worth_delta == null ? "text-ink-tertiary"
                  : review.net_worth_delta >= 0 ? "text-semantic-income"
                  : "text-semantic-expense"
              )}>
                {review.net_worth_delta != null
                  ? `${review.net_worth_delta >= 0 ? "+" : ""}${fmt(review.net_worth_delta)}`
                  : "—"}
              </p>
              {review.net_worth_delta != null && (
                <p className="text-[10px] text-ink-tertiary mt-1">
                  {review.net_worth_delta >= 0 ? "grew this month" : "shrank this month"}
                </p>
              )}
            </div>

            {/* Budgets */}
            <div className="hive-card p-4 cursor-pointer hover:bg-white/[0.04] transition-colors" onClick={() => router.push(`/budgets?month=${month}`)}>
              <p className="hive-label mb-2">Budgets</p>
              <div className="flex items-end gap-2">
                <p className={cn(
                  "text-[22px] font-extrabold font-mono tracking-tight",
                  review.budget_categories_over > 0 ? "text-semantic-expense" : "text-semantic-income"
                )}>
                  {review.budget_categories_over}
                </p>
                <p className="text-[11px] text-ink-tertiary mb-1">over</p>
                <p className="text-[11px] text-semantic-income mb-1">/ {review.budget_categories_under} under</p>
              </div>
            </div>

            {/* Uncategorized */}
            <div
              className={cn("hive-card p-4", review.uncategorized_count > 0 && "cursor-pointer hover:bg-white/[0.04] transition-colors")}
              onClick={review.uncategorized_count > 0 ? () => router.push(`/transactions?category=Uncategorized&month=${month}`) : undefined}
            >
              <p className="hive-label mb-2">Uncategorized</p>
              <p className={cn(
                "text-[22px] font-extrabold font-mono tracking-tight",
                review.uncategorized_count > 0 ? "text-honey" : "text-semantic-income"
              )}>
                {review.uncategorized_count}
              </p>
              <p className="text-[10px] text-ink-tertiary mt-1">
                {review.uncategorized_count > 0 ? "need review" : "all categorized"}
              </p>
            </div>

            {/* Income vs spend */}
            <div className="hive-card p-4 cursor-pointer hover:bg-white/[0.04] transition-colors" onClick={() => router.push(`/cash-flow`)}>
              <p className="hive-label mb-2">Savings rate</p>
              <p className={cn(
                "text-[22px] font-extrabold font-mono tracking-tight",
                net >= 0 ? "text-semantic-income" : "text-semantic-expense"
              )}>
                {review.total_income > 0
                  ? `${((net / review.total_income) * 100).toFixed(1)}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-ink-tertiary mt-1">income saved</p>
            </div>
          </div>

          {/* Main content: spend changes + points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Biggest spend changes */}
            <div className="hive-card overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <p className="text-[13px] font-medium text-ink-primary">Biggest Changes vs Last Month</p>
              </div>
              {review.top_spend_changes.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-ink-tertiary">No comparison data yet.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {review.top_spend_changes.map((d) => {
                    const isUp = d.delta > 0;
                    const isFlat = Math.abs(d.delta) < 0.5;
                    return (
                      <div
                        key={d.category}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
                        onClick={() => router.push(`/transactions?category=${encodeURIComponent(d.category || "Uncategorized")}&month=${month}`)}
                      >
                        <span className={cn("shrink-0", isFlat ? "text-ink-tertiary" : isUp ? "text-semantic-expense" : "text-semantic-income")}>
                          {isFlat ? <Minus size={14} /> : isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </span>
                        <p className="text-[13px] text-ink-primary flex-1 truncate">{d.category || "Uncategorized"}</p>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            "text-[13px] font-mono font-semibold tabular-nums",
                            isFlat ? "text-ink-tertiary" : isUp ? "text-semantic-expense" : "text-semantic-income"
                          )}>
                            {d.delta > 0 ? "+" : ""}{fmt(d.delta)}
                            {!isFlat && Math.abs(d.delta_pct) < 1000 && (
                              <span className="text-[10px] font-normal ml-1 opacity-70">
                                {d.delta_pct > 0 ? "+" : ""}{Math.round(d.delta_pct)}%
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-ink-tertiary">{fmt(d.this_month)} this month</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Points earned */}
            <div className="hive-card overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <p className="text-[13px] font-medium text-ink-primary">Points Earned This Month</p>
              </div>
              {review.points_earned.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-ink-tertiary">No points data yet.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {review.points_earned.map((p) => (
                    <div key={p.program} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => router.push(`/points?program=${encodeURIComponent(p.program)}`)}>
                      <div className="w-7 h-7 rounded-lg bg-honey/10 border border-honey/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-honey font-bold">{p.program.split(" ")[0][0]}{p.program.split(" ")[1]?.[0] ?? ""}</span>
                      </div>
                      <p className="text-[13px] text-ink-primary flex-1 truncate">{p.program}</p>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums">
                          {Math.round(p.points_earned).toLocaleString()} pts
                        </p>
                        <p className="text-[10px] text-semantic-income">{fmt(p.estimated_value)} est. value</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Uncategorized CTA */}
          {review.uncategorized_count > 0 && (
            <div className="hive-card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-honey shrink-0" />
                <p className="text-[13px] text-ink-primary">
                  <strong>{review.uncategorized_count}</strong> transaction{review.uncategorized_count !== 1 ? "s" : ""} still need{review.uncategorized_count === 1 ? "s" : ""} categories
                </p>
              </div>
              <Link
                href={`/transactions?category=Uncategorized&month=${month}`}
                className="hive-btn-primary text-[12px] px-4 py-1.5 shrink-0"
              >
                Review Now
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* All-clear */}
          {review.uncategorized_count === 0 && review.budget_categories_over === 0 && (
            <div className="hive-card p-4 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-semantic-income shrink-0" />
              <p className="text-[13px] text-ink-primary">
                All clear — {monthLabel(month)} is fully categorized and all budgets held.
              </p>
            </div>
          )}

          {/* Category breakdown chart */}
          {catChartData.length > 0 && (
            <div className="hive-card overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <p className="text-[13px] font-medium text-ink-primary">Spending by Category</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">This month vs last month, top 8 categories</p>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={catChartData}
                    layout="vertical"
                    barCategoryGap="25%"
                    barGap={3}
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={100}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,15,20,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.85)",
                      }}
                      formatter={(value: number, name: string) => [fmt(value), name]}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)", paddingTop: 8 }}
                    />
                    <Bar dataKey="Last Month" fill="rgba(148,163,184,0.30)" radius={[0, 3, 3, 0]} cursor="pointer" onClick={(d: { category: string }) => router.push(`/transactions?category=${encodeURIComponent(d.category)}&month=${prevMonth(month)}`)} />
                    <Bar dataKey="This Month" fill="rgba(251,113,133,0.55)" radius={[0, 3, 3, 0]} cursor="pointer" onClick={(d: { category: string }) => router.push(`/transactions?category=${encodeURIComponent(d.category)}&month=${month}`)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Income / spend / net summary bar */}
          <div className="hive-card p-5">
            <div className="flex items-center gap-8 flex-wrap">
              <div>
                <p className="hive-label mb-1">Income</p>
                <p className="text-[18px] font-bold font-mono text-semantic-income tabular-nums">{fmt(review.total_income)}</p>
              </div>
              <div className="text-ink-ghost text-[18px] font-light">−</div>
              <div>
                <p className="hive-label mb-1">Spend</p>
                <p className="text-[18px] font-bold font-mono text-ink-primary tabular-nums">{fmt(review.total_spend)}</p>
              </div>
              <div className="text-ink-ghost text-[18px] font-light">=</div>
              <div>
                <p className="hive-label mb-1">Net</p>
                <p className={cn(
                  "text-[18px] font-bold font-mono tabular-nums",
                  net >= 0 ? "text-semantic-income" : "text-semantic-expense"
                )}>
                  {net >= 0 ? "+" : ""}{fmt(net)}
                  {net < 0 && <ArrowDownRight className="inline-block w-4 h-4 ml-1 align-middle" />}
                  {net >= 0 && <ArrowUpRight className="inline-block w-4 h-4 ml-1 align-middle" />}
                </p>
              </div>
              {review.net_worth_end != null && (
                <>
                  <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />
                  <div>
                    <p className="hive-label mb-1">Net Worth</p>
                    <p className="text-[18px] font-bold font-mono text-ink-primary tabular-nums">{fmt(review.net_worth_end)}</p>
                    {review.net_worth_start != null && (
                      <p className="text-[10px] text-ink-tertiary">from {fmt(review.net_worth_start)}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
