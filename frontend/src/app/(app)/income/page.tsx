"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import { fmt, cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";
import { ChartTooltip, CHART_AXIS_PROPS } from "@/components/ChartTooltip";
import { MonthPicker } from "@/components/MonthPicker";
import { Sparkles } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ForecastPoint = { month: string; income: number; low: number; high: number };
type ChartPoint = { month: string; income?: number; predicted?: number; count?: number; isForecast?: boolean };

export default function IncomePage() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<{ total_income: number; sources: { source: string; amount: number; count: number; pct: number }[] } | null>(null);
  const [monthly, setMonthly] = useState<{ month: string; income: number; count: number }[]>([]);
  const [forecast, setForecast] = useState<{ forecast: ForecastPoint[]; avg: number; confidence_band: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const months: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.income.summary(month),
      api.income.monthly(12),
      api.income.forecast(),
    ])
      .then(([sumR, monR, fcastR]) => {
        if (sumR.status === "fulfilled") setSummary(sumR.value);
        else toast.error("Failed to load income summary");
        if (monR.status === "fulfilled") setMonthly(monR.value);
        else toast.error("Failed to load income history");
        if (fcastR.status === "fulfilled") setForecast(fcastR.value);
      })
      .finally(() => setLoading(false));
  }, [month]);

  const maxMonthly = Math.max(...monthly.map((m) => m.income), 1);
  const avgIncome = monthly.length > 0 ? monthly.reduce((s, m) => s + m.income, 0) / monthly.length : 0;
  const ytdIncome = monthly
    .filter((m) => m.month.startsWith(new Date().getFullYear().toString()))
    .reduce((s, m) => s + m.income, 0);

  const nextMonth = (() => {
    const now = new Date();
    const m = now.getMonth() + 2; // +1 for next month, +1 because getMonth() is 0-based
    const y = m > 12 ? now.getFullYear() + 1 : now.getFullYear();
    return `${y}-${String(m > 12 ? m - 12 : m).padStart(2, "0")}`;
  })();
  const nextMonthForecast = forecast?.forecast.find(f => f.month === nextMonth);

  // Merge actual history + forecast into a single chart dataset
  const chartData: ChartPoint[] = [
    ...monthly.map(m => ({ month: m.month, income: m.income, count: m.count, isForecast: false })),
    ...(forecast?.forecast ?? []).map(f => ({ month: f.month, predicted: f.income, isForecast: true })),
  ];
  const maxChart = Math.max(...chartData.map(d => d.income ?? d.predicted ?? 0), 1);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow="Income"
            headline={
              summary
                ? <><span className="text-semantic-income">+{fmt(summary.total_income)}</span></>
                : <span className="text-ink-secondary">—</span>
            }
            subtext={`${monthLabel(month)} income from ${summary?.sources.length ?? 0} sources`}
            statStrip={[
              { label: monthLabel(month),  value: summary ? fmt(summary.total_income) : "—", color: "green"   },
              { label: "Monthly avg",      value: avgIncome > 0 ? fmt(avgIncome) : "—",        color: "default" },
              { label: `${new Date().getFullYear()} YTD`, value: ytdIncome > 0 ? fmt(ytdIncome) : "—", color: "amber" },
              ...(nextMonthForecast ? [{ label: `${monthLabel(nextMonth)} est.`, value: fmt(nextMonthForecast.income), color: "default" as const }] : []),
            ]}
          />
        </div>

        <MonthPicker month={month} onChange={setMonth} maxMonth={currentMonth()} className="mt-2 shrink-0" />
      </div>

      {/* 12-month trend chart + forecast */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium text-ink-primary">Income Trend & Forecast</p>
          {forecast && forecast.forecast.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-ink-ghost">
              <Sparkles className="w-3 h-3 text-honey/60" />
              <span>{forecast.forecast.length}-month prediction</span>
            </div>
          )}
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }} barSize={14}>
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                {...CHART_AXIS_PROPS}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {forecast?.avg && (
                <ReferenceLine
                  y={forecast.avg}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="4 3"
                />
              )}
              <Bar
                dataKey="income"
                name="Income"
                radius={[3, 3, 0, 0]}
                cursor="pointer"
                onClick={(data: ChartPoint) => { if (!data.isForecast && data.month) setMonth(data.month); }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill={entry.month === month ? "#059669" : "rgba(5,150,105,0.3)"}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="predicted"
                name="Predicted"
                radius={[3, 3, 0, 0]}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`p-${entry.month}`}
                    fill="rgba(251,191,36,0.25)"
                    stroke="rgba(251,191,36,0.5)"
                    strokeWidth={1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-ink-tertiary text-[13px]">
            No income data yet
          </div>
        )}
        <div className="flex items-center gap-4 mt-2">
          {avgIncome > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-8 border-t border-dashed border-white/20" />
              <span className="text-[11px] text-ink-ghost">avg {fmt(avgIncome)}/mo</span>
            </div>
          )}
          {forecast && forecast.forecast.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-honey/25 border border-honey/50" />
              <span className="text-[11px] text-ink-ghost">predicted</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Income sources breakdown */}
      <GlassCard className="overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-ink-primary">Sources · {monthLabel(month)}</p>
            {summary?.total_income ? (
              <p className="text-[11px] text-ink-tertiary mt-0.5">
                {fmt(summary.total_income)} from {summary.sources.length} source{summary.sources.length !== 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-white/[0.03] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !summary || summary.sources.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-ink-secondary">No income in {monthLabel(month)}</p>
            <p className="text-[11px] text-ink-tertiary mt-1">Income = transactions with negative amounts (credits)</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {summary.sources.map((s) => (
              <Link
                key={s.source}
                href={`/transactions?month=${month}&search=${encodeURIComponent(s.source)}&include_excluded=true`}
                className="block px-5 py-3 hover:bg-white/[0.02] transition-colors no-underline group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-ink-primary truncate max-w-[240px] group-hover:text-honey/90 transition-colors">
                      {s.source}
                    </span>
                    {s.count > 1 && (
                      <span className="text-[10px] text-ink-ghost shrink-0">×{s.count}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-ink-tertiary">{s.pct.toFixed(1)}%</span>
                    <span className="text-[13px] font-mono font-semibold text-semantic-income tabular-nums">
                      +{fmt(s.amount)}
                    </span>
                  </div>
                </div>
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-semantic-income/50 rounded-full transition-all duration-500"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Month-by-month table */}
      {monthly.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-[13px] font-medium text-ink-primary">Month-by-Month</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {/* Forecast rows (future months, newest first) */}
            {forecast && [...forecast.forecast].reverse().map((f) => {
              const barW = Math.min(100, (f.income / maxChart) * 100);
              return (
                <div
                  key={f.month}
                  className="w-full flex items-center gap-3 px-5 py-2.5"
                >
                  <span className="text-[12px] font-mono w-14 shrink-0 text-honey/60">
                    {monthLabel(f.month)}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-honey/20 border border-honey/30 transition-all duration-300"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-mono font-semibold tabular-nums w-24 text-right shrink-0 text-honey/60">
                    ~{fmt(f.income)}
                  </span>
                  <div className="flex items-center justify-end w-10 shrink-0">
                    <Sparkles className="w-3 h-3 text-honey/40" />
                  </div>
                </div>
              );
            })}
            {/* Actual rows */}
            {[...monthly].reverse().map((m) => {
              const barW = Math.min(100, (m.income / maxChart) * 100);
              const isSelected = m.month === month;
              return (
                <button
                  key={m.month}
                  onClick={() => setMonth(m.month)}
                  className={cn(
                    "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-semantic-income/[0.05] border-l-2 border-l-semantic-income"
                      : "hover:bg-white/[0.025]"
                  )}
                >
                  <span className={cn(
                    "text-[12px] font-mono w-14 shrink-0",
                    isSelected ? "text-semantic-income" : "text-ink-tertiary"
                  )}>
                    {monthLabel(m.month)}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isSelected ? "bg-semantic-income/60" : "bg-semantic-income/25"
                      )}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[13px] font-mono font-semibold tabular-nums w-24 text-right shrink-0",
                    isSelected ? "text-semantic-income" : "text-ink-secondary"
                  )}>
                    +{fmt(m.income)}
                  </span>
                  <span className="text-[10px] text-ink-ghost w-10 text-right shrink-0">
                    {m.count}×
                  </span>
                </button>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
