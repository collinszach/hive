"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api, type NetWorthSnapshot } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Net Worth</h1>
          <p className="text-sm text-slate-500 mt-0.5">Balance sheet over time</p>
        </div>
        <div className="flex gap-1">
          {([30, 90, 180, 365] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {r === 365 ? "1Y" : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-900 border border-slate-800 border-l-[3px] border-l-indigo-500 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Net Worth</p>
            <p className="text-2xl font-bold text-white tabular-nums">{fmt(latest.net_worth)}</p>
            {change !== null && (
              <div className={`flex items-center gap-1 mt-1.5 text-sm ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                <span className="font-medium tabular-nums">{change >= 0 ? "+" : ""}{fmt(change)}</span>
                <span className="text-slate-500 text-xs">this period</span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 border-l-[3px] border-l-emerald-500 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Total Assets</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmt(latest.total_assets)}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 border-l-[3px] border-l-rose-500 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Total Liabilities</p>
            <p className="text-2xl font-bold text-rose-400 tabular-nums">{fmt(latest.total_liabilities)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">Net Worth Over Time</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm animate-pulse">Loading…</div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center text-rose-400 text-sm">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm text-center">
            No data yet — net worth is snapshotted daily once accounts are linked.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(value: number) => [fmt(value), ""]}
              />
              <Legend wrapperStyle={{ color: "#64748b", fontSize: 12 }} />
              <Line type="monotone" dataKey="Net Worth" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Assets" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Liabilities" stroke="#f43f5e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Account breakdown */}
      {latest && Object.keys(latest.breakdown).length > 0 && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Account Breakdown</h2>
          <div className="divide-y divide-slate-800/60">
            {Object.entries(latest.breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([name, value]) => (
                <div key={name} className="flex justify-between items-center py-2.5 text-sm">
                  <span className="text-slate-300">{name}</span>
                  <span className={`font-medium tabular-nums ${value >= 0 ? "text-slate-200" : "text-rose-400"}`}>
                    {fmt(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
