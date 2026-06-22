"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fmt } from "@/lib/utils";
import type { PaperPerformancePoint } from "@/lib/api";

export function PerformanceChart({ data }: { data: PaperPerformancePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6">
        <div className="text-sm font-semibold text-ink-primary">Performance</div>
        <div className="mt-8 mb-8 text-center text-[13px] text-ink-tertiary">
          No mark-to-market snapshots yet. The daily simulation cycle writes one each trading day.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      <div className="mb-4 text-sm font-semibold text-ink-primary">Portfolio vs benchmark</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="as_of"
              tick={{ fontSize: 11, fill: "var(--color-ink-tertiary)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-ink-tertiary)" }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => fmt(Number(v))}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-base)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number, name: string) => [fmt(Number(v)), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="portfolio_value"
              name="Strategy"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="benchmark_value"
              name="Benchmark"
              stroke="var(--color-ink-tertiary)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
