"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeakageEntry, LeakageResponse } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

function slugToLabel(slug: string): string {
  const map: Record<string, string> = {
    amex_gold: "Amex Gold",
    chase_sapphire: "Chase Sapphire",
    chase_southwest: "Chase SW",
    bilt_blue: "Bilt",
    venture_x: "Venture X",
  };
  return map[slug] ?? slug;
}

export function LeakageSummary({
  data,
  loading,
  error,
}: {
  data: LeakageResponse | null;
  loading: boolean;
  error: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  if (loading) {
    return (
      <div className="hive-card p-5">
        <div className="h-4 w-48 bg-white/[0.05] rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const hasLeakage = data.total_leakage_dollars > 0;

  return (
    <GlassCard tint={hasLeakage ? "expense" : "none"} className="overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasLeakage ? "bg-semantic-expense/[0.12]" : "bg-semantic-income/[0.12]"}`}>
            {hasLeakage
              ? <TrendingDown className="w-4 h-4 text-semantic-expense" />
              : <AlertTriangle className="w-4 h-4 text-semantic-income" />
            }
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink-primary">Missed Earnings</p>
            {hasLeakage ? (
              <p className="text-[12px] text-semantic-expense">
                {fmt(data.total_leakage_dollars)} left on the table across {data.transaction_count} transaction{data.transaction_count !== 1 ? "s" : ""} ({data.days}d)
              </p>
            ) : (
              <p className="text-[12px] text-semantic-income">
                Great card usage — no significant optimization opportunities found ({data.days}d)
              </p>
            )}
          </div>
        </div>
        {hasLeakage && (
          expanded ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />
        )}
      </button>

      {/* Table */}
      {expanded && hasLeakage && (
        <div className="overflow-x-auto border-t border-white/[0.04]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Date", "Merchant", "Amount", "Used", "Should've Used", "Missed"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-ink-tertiary text-[11px] tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {data.entries.map((e: LeakageEntry) => (
                <tr
                  key={String(e.transaction_id)}
                  className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/transactions?open_tx=${e.transaction_id}&search_all=true${e.merchant ? `&search=${encodeURIComponent(e.merchant)}` : ""}`
                    )
                  }
                >
                  <td className="px-4 py-2.5 text-ink-tertiary font-mono whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-2.5 text-ink-primary max-w-[160px] truncate">{e.merchant ?? e.category ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-ink-secondary whitespace-nowrap">{fmt(e.amount)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-ink-tertiary bg-white/[0.05] px-2 py-0.5 rounded text-[11px]">
                      {slugToLabel(e.actual_card_slug)} ({e.actual_earn_rate}x)
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-semantic-income bg-semantic-income/[0.08] px-2 py-0.5 rounded text-[11px]">
                      {slugToLabel(e.best_card_slug)} ({e.best_earn_rate}x)
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-semantic-expense whitespace-nowrap">
                    -{fmt(e.leakage_dollars)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
