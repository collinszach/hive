"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, MonthlyCashFlow, CashFlowSummary, SpendByCategory, FlowData } from "@/lib/api";
import { NodeFlow } from "./_components/NodeFlow";
import { fmt, monthLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";
import { ChartTooltip, CHART_GRID_PROPS, CHART_AXIS_PROPS } from "@/components/ChartTooltip";

const MONTH_ABBR: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function fmtMonth(ym: string) {
  const [, m] = ym.split("-");
  return MONTH_ABBR[m] ?? ym;
}

/** Derive the last day of a YYYY-MM string */
function lastDayOf(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Category color palette — cycles through a set of accent colors
const CAT_COLORS = [
  "#F5B942", // honey
  "#7C6AFA", // violet
  "#32D583", // income green
  "#38BDF8", // sky
  "#FB923C", // orange
  "#F472B6", // pink
  "#A3E635", // lime
  "#34D399", // emerald
  "#60A5FA", // blue
  "#C084FC", // purple
  "#F97066", // expense red
  "#FBBF24", // amber
];

interface DrillDownState {
  month: string;       // YYYY-MM
  categories: SpendByCategory[];
  loading: boolean;
}

export default function CashFlowPage() {
  const router = useRouter();
  const [monthly, setMonthly]               = useState<MonthlyCashFlow[]>([]);
  const [summary, setSummary]               = useState<CashFlowSummary | null>(null);
  const [flowData, setFlowData]             = useState<FlowData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [view, setView]                     = useState<"net" | "split">("split");
  const [drillDown, setDrillDown]           = useState<DrillDownState | null>(null);
  const [selectedKpiMonth, setSelectedKpiMonth] = useState<string>(currentYearMonth());

  useEffect(() => {
    api.cashFlow.monthly(12).then(setMonthly).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSummaryLoading(true);
    api.cashFlow.summary(selectedKpiMonth)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [selectedKpiMonth]);

  useEffect(() => {
    api.cashFlow.flow(selectedKpiMonth).then(setFlowData).catch(() => setFlowData(null));
  }, [selectedKpiMonth]);

  const selectMonth = useCallback(async (ym: string) => {
    // If already selected, close
    if (drillDown?.month === ym && !drillDown.loading) {
      setDrillDown(null);
      return;
    }
    setDrillDown({ month: ym, categories: [], loading: true });
    try {
      const start = `${ym}-01`;
      const end   = `${ym}-${String(lastDayOf(ym)).padStart(2, "0")}`;
      const cats  = await api.reports.spendingByCategory(start, end);
      setDrillDown({ month: ym, categories: cats, loading: false });
    } catch {
      setDrillDown(null);
    }
  }, [drillDown]);

  // Chart highlights the selectedKpiMonth
  const selectedMonth = selectedKpiMonth;

  // Build chart data preserving the YYYY-MM for selection matching
  const chartData = monthly.map((m) => ({
    month:    fmtMonth(m.month),
    monthKey: m.month,
    income:   m.income,
    expenses: m.expenses,
    net:      m.net,
  }));

  const totalCategorySpend = drillDown?.categories.reduce((s, c) => s + c.total, 0) ?? 0;

  // Derive hero stats from summary
  const netCashFlow = summary ? summary.net_savings : 0;
  const savingsRate = summary ? (summary.savings_rate_pct ?? 0) : 0;
  const selectedPeriodLabel = monthLabel(selectedKpiMonth);

  // Custom bar click handler shape from recharts
  const handleBarClick = (data: { activePayload?: Array<{ payload: { monthKey?: string } }> } | null) => {
    const mk = data?.activePayload?.[0]?.payload?.monthKey;
    if (mk) {
      selectMonth(mk);
      setSelectedKpiMonth(mk);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* PageHero */}
      <PageHero
        eyebrow={`Cash Flow · ${selectedPeriodLabel}`}
        headline={
          summary ? (
            <span className={netCashFlow >= 0 ? "text-semantic-income" : "text-semantic-expense"}>
              {netCashFlow >= 0 ? "+" : ""}{fmt(netCashFlow)}
            </span>
          ) : (
            <span className="text-ink-secondary">—</span>
          )
        }
        subtext="net cash flow this period"
        glowColor="emerald"
        statStrip={summary ? [
          { label: "Income",       value: fmt(summary.income),    color: "green" },
          { label: "Expenses",     value: fmt(summary.expenses),  color: "red" },
          { label: "Savings Rate", value: `${savingsRate.toFixed(1)}%`, color: "amber" },
          { label: "Net",          value: (netCashFlow >= 0 ? "+" : "") + fmt(netCashFlow), color: netCashFlow >= 0 ? "green" : "red" },
        ] : undefined}
      />

      {/* KPI row */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedKpiMonth(m => shiftMonth(m, -1)); setDrillDown(null); }}
              className="p-1 rounded-md hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-[13px] font-medium text-ink-primary w-24 text-center">
              {monthLabel(selectedKpiMonth)}
            </p>
            <button
              onClick={() => { setSelectedKpiMonth(m => shiftMonth(m, 1)); setDrillDown(null); }}
              className="p-1 rounded-md hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors"
              disabled={selectedKpiMonth >= currentYearMonth()}
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {summaryLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-tertiary" />}
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Income",      value: fmt(summary.income),      color: "text-semantic-income" },
              { label: "Expenses",    value: fmt(summary.expenses),     color: "text-semantic-expense" },
              { label: "Net Savings", value: fmt(summary.net_savings),  color: summary.net_savings >= 0 ? "text-semantic-income" : "text-semantic-expense" },
              { label: "Savings Rate", value: `${(summary.savings_rate_pct ?? 0).toFixed(1)}%`, color: (summary.savings_rate_pct ?? 0) >= 20 ? "text-semantic-income" : (summary.savings_rate_pct ?? 0) >= 10 ? "text-honey" : "text-semantic-expense" },
            ].map(({ label, value, color }) => (
              <GlassCard key={label} className="p-4">
                <p className="hive-label mb-2">{label}</p>
                <p className={cn("text-[20px] font-semibold font-mono tabular-nums", color)}>{value}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Flow chart */}
      {flowData && flowData.income > 0 && (
        <GlassCard className="p-5">
          <div className="mb-4">
            <p className="text-[13px] font-medium text-ink-primary">Income Flow</p>
            <p className="text-[11px] text-ink-tertiary mt-0.5">
              Where your {fmt(flowData.income)} went in {monthLabel(selectedKpiMonth)}
            </p>
          </div>
          <NodeFlow
            data={flowData}
            month={monthLabel(selectedKpiMonth)}
            onCategoryClick={(category) =>
              router.push(`/transactions?category=${encodeURIComponent(category)}&month=${selectedKpiMonth}`)
            }
          />
        </GlassCard>
      )}

      {/* Chart */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[13px] font-medium text-ink-primary">12-Month Overview</p>
            {!loading && (
              <p className="text-[11px] text-ink-tertiary mt-0.5">Click any bar to see category breakdown</p>
            )}
          </div>
          <div className="flex items-center gap-1 bg-elevated rounded-lg p-1">
            {(["split", "net"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-medium transition-colors",
                  view === v ? "bg-white/[0.08] text-ink-primary" : "text-ink-tertiary hover:text-ink-secondary"
                )}
              >
                {v === "split" ? "Income / Expense" : "Net"}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          {view === "split" ? (
            <BarChart
              data={chartData}
              barCategoryGap="30%"
              barGap={2}
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="rgba(5,150,105,0.3)" />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="rgba(220,38,38,0.2)" />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} vertical={false} />
              <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
              <YAxis {...CHART_AXIS_PROPS} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="income" name="Income" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill="url(#incomeGrad)"
                    opacity={selectedMonth && selectedMonth !== entry.monthKey ? 0.35 : 1}
                  />
                ))}
              </Bar>
              <Bar dataKey="expenses" name="Expenses" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill="url(#expenseGrad)"
                    opacity={selectedMonth && selectedMonth !== entry.monthKey ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart
              data={chartData}
              barCategoryGap="40%"
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="rgba(5,150,105,0.3)" />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="rgba(220,38,38,0.2)" />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} vertical={false} />
              <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
              <YAxis {...CHART_AXIS_PROPS} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.net >= 0 ? "url(#incomeGrad)" : "url(#expenseGrad)"}
                    opacity={selectedMonth && selectedMonth !== entry.monthKey ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </GlassCard>

      {/* Category drill-down panel */}
      {drillDown && (
        <GlassCard className="overflow-hidden">
          {/* Header */}
          <div className="hive-section-header">
            <div>
              <p className="text-[13px] font-medium text-ink-primary">
                Category Breakdown — {monthLabel(drillDown.month)}
              </p>
              {!drillDown.loading && (
                <p className="text-[11px] text-ink-tertiary mt-0.5">
                  {drillDown.categories.length} categories · {fmt(totalCategorySpend)} total
                </p>
              )}
            </div>
            <button
              onClick={() => setDrillDown(null)}
              className="hive-btn-ghost p-1.5 rounded-lg text-ink-tertiary hover:text-ink-primary"
              aria-label="Close breakdown"
            >
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          {drillDown.loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-ink-tertiary text-[13px]">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading category breakdown…</span>
            </div>
          ) : drillDown.categories.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-ink-tertiary">
              No expense data for this month.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {drillDown.categories.map((cat, i) => {
                const pct   = totalCategorySpend > 0 ? (cat.total / totalCategorySpend) * 100 : 0;
                const color = CAT_COLORS[i % CAT_COLORS.length];
                return (
                  <div key={`${cat.category}-${cat.subcategory ?? "all"}`} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Color swatch */}
                        <span
                          className="shrink-0 w-2 h-2 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="text-[13px] text-ink-primary truncate">{cat.category}</span>
                        {cat.subcategory && (
                          <span className="text-[11px] text-ink-tertiary shrink-0">· {cat.subcategory}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[11px] text-ink-tertiary tabular-nums">
                          {cat.transaction_count} txn{cat.transaction_count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[11px] text-ink-tertiary tabular-nums w-10 text-right">
                          {pct.toFixed(1)}%
                        </span>
                        <span className="text-[13px] font-mono font-medium text-ink-primary tabular-nums w-24 text-right">
                          {fmt(cat.total)}
                        </span>
                      </div>
                    </div>
                    {/* Relative bar */}
                    <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden ml-4">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* Monthly breakdown table */}
      <GlassCard className="overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <p className="text-[13px] font-medium text-ink-primary">Monthly Breakdown</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {[...monthly].reverse().map((m) => {
            const isSelected = selectedMonth === m.month;
            return (
              <button
                key={m.month}
                onClick={() => {
                  selectMonth(m.month);
                  setSelectedKpiMonth(m.month);
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-3 text-left transition-colors",
                  "hover:bg-white/[0.025] cursor-pointer",
                  isSelected && "bg-honey/[0.06] hover:bg-honey/[0.08]"
                )}
              >
                <div className="flex items-center gap-2 w-16 shrink-0">
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-honey shrink-0" />
                  )}
                  <span className={cn(
                    "text-[12px]",
                    isSelected ? "text-honey font-medium" : "text-ink-tertiary"
                  )}>
                    {fmtMonth(m.month)}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4 text-right">
                  <div>
                    <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Income</p>
                    <p className="text-[12px] font-mono text-semantic-income">{fmt(m.income)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Expenses</p>
                    <p className="text-[12px] font-mono text-semantic-expense">{fmt(m.expenses)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Net</p>
                    <p className={cn("text-[12px] font-mono font-semibold", m.net >= 0 ? "text-semantic-income" : "text-semantic-expense")}>
                      {m.net >= 0 ? "+" : ""}{fmt(m.net)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
