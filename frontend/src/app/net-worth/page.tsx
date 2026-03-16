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
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Net Worth</h1>
        <div className="flex gap-2">
          {([30, 90, 180, 365] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {r === 365 ? "1Y" : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Net Worth</p>
            <p className="text-2xl font-bold text-white">{fmt(latest.net_worth)}</p>
            {change !== null && (
              <p className={`text-sm mt-1 ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {change >= 0 ? "+" : ""}{fmt(change)} this period
              </p>
            )}
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-green-400">{fmt(latest.total_assets)}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Liabilities</p>
            <p className="text-2xl font-bold text-red-400">{fmt(latest.total_liabilities)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-8">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Net Worth Over Time</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading…</div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center text-red-400">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No data yet — net worth is snapshotted daily once accounts are linked.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#E5E7EB" }}
                formatter={(value: number) => fmt(value)}
              />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
              <Line type="monotone" dataKey="Net Worth" stroke="#6366F1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Assets" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Liabilities" stroke="#EF4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown table */}
      {latest && Object.keys(latest.breakdown).length > 0 && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Latest Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(latest.breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([name, value]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span className="text-gray-300">{name}</span>
                  <span className={`font-medium ${value >= 0 ? "text-white" : "text-red-400"}`}>
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
