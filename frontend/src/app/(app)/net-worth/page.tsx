"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, type NetWorthSnapshot } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";
import { ChartTooltip, CHART_GRID_PROPS, CHART_AXIS_PROPS } from "@/components/ChartTooltip";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Range = 30 | 90 | 180 | 365;

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthSnapshot[]>([]);
  const [range, setRange] = useState<Range>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.netWorth
      .history(range)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  const latest = data[data.length - 1];
  const earliest = data[0];
  const change = latest && earliest ? latest.net_worth - earliest.net_worth : null;

  const chartData = data.map((s) => ({
    date: fmtDate(s.snapshot_date),
    "Net Worth": Math.round(s.net_worth),
    Assets: Math.round(s.total_assets),
    Liabilities: Math.round(s.total_liabilities),
  }));

  const changeDeltaStr = change !== null
    ? `${change >= 0 ? "+" : ""}${fmt(change)} this period`
    : undefined;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* PageHero */}
      <PageHero
        eyebrow="Net Worth"
        headline={
          latest ? (
            <span className="text-[#38BDF8]">{fmt(latest.net_worth)}</span>
          ) : (
            <span className="text-ink-secondary">—</span>
          )
        }
        subtext={changeDeltaStr ?? "balance sheet over time"}
        glowColor="sky"
        statStrip={latest ? [
          { label: "Assets",      value: fmt(latest.total_assets),      color: "green" },
          { label: "Liabilities", value: fmt(latest.total_liabilities),  color: "red" },
          { label: "Change",      value: change !== null ? `${change >= 0 ? "+" : ""}${fmt(change)}` : "—", color: change !== null && change >= 0 ? "green" : "red" },
        ] : undefined}
      />

      {/* Range tabs */}
      <div className="flex gap-1.5">
        {([30, 90, 180, 365] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors",
              range === r
                ? "bg-honey/[0.12] border border-honey/25 text-honey font-semibold"
                : "bg-elevated border border-white/[0.06] text-ink-secondary hover:text-ink-primary"
            )}
          >
            {r === 365 ? "1Y" : `${r}D`}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassCard tint="sky" className="p-5">
            <p className="text-[10px] font-bold text-ink-ghost uppercase tracking-wider mb-3">Net Worth</p>
            <p className="text-[22px] font-bold text-ink-primary tabular-nums">{fmt(latest.net_worth)}</p>
            {change !== null && (
              <div className={cn("flex items-center gap-1 mt-1.5 text-[13px]", change >= 0 ? "text-semantic-income" : "text-semantic-expense")}>
                {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                <span className="font-medium tabular-nums">{change >= 0 ? "+" : ""}{fmt(change)}</span>
                <span className="text-ink-tertiary text-[11px]">this period</span>
              </div>
            )}
          </GlassCard>
          <GlassCard tint="income" className="p-5">
            <p className="text-[10px] font-bold text-ink-ghost uppercase tracking-wider mb-3">Total Assets</p>
            <p className="text-[22px] font-bold text-semantic-income tabular-nums">{fmt(latest.total_assets)}</p>
          </GlassCard>
          <GlassCard tint="expense" className="p-5">
            <p className="text-[10px] font-bold text-ink-ghost uppercase tracking-wider mb-3">Total Liabilities</p>
            <p className="text-[22px] font-bold text-semantic-expense tabular-nums">{fmt(latest.total_liabilities)}</p>
          </GlassCard>
        </div>
      )}

      {/* Chart */}
      <GlassCard className="p-5">
        <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-5">Net Worth Over Time</p>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-ink-tertiary text-[13px] animate-pulse">Loading…</div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center text-semantic-expense text-[13px]">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-ink-tertiary text-[13px] text-center">
            No data yet — net worth is snapshotted daily once accounts are linked.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="date" {...CHART_AXIS_PROPS} />
              <YAxis
                {...CHART_AXIS_PROPS}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
              <Area
                type="monotone"
                dataKey="Net Worth"
                stroke="#38BDF8"
                strokeWidth={2.5}
                fill="url(#nwGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Account breakdown */}
      {latest && Object.keys(latest.breakdown).length > 0 && (
        <GlassCard className="p-5">
          <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider mb-4">Account Breakdown</p>
          <div className="divide-y divide-white/[0.04]">
            {Object.entries(latest.breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([name, value]) => (
                <div key={name} className="flex justify-between items-center py-2.5 text-[13px]">
                  <span className="text-ink-secondary">{name}</span>
                  <span className={cn("font-medium tabular-nums", value >= 0 ? "text-ink-primary" : "text-semantic-expense")}>
                    {fmt(value)}
                  </span>
                </div>
              ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
