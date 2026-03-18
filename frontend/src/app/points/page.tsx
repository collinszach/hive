import { api } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Star, TrendingUp, Bell } from "lucide-react";

export const revalidate = 60;

const PROGRAM_ACCENTS: Record<string, { bar: string; badge: string }> = {
  "Amex MR":           { bar: "bg-emerald-500", badge: "text-emerald-400" },
  "Chase UR":          { bar: "bg-blue-500",    badge: "text-blue-400" },
  "SW RR":             { bar: "bg-orange-500",   badge: "text-orange-400" },
  "Bilt Points":       { bar: "bg-violet-500",   badge: "text-violet-400" },
  "WF Rewards":        { bar: "bg-red-500",      badge: "text-red-400" },
  "Capital One Miles": { bar: "bg-sky-500",      badge: "text-sky-400" },
};

export default async function PointsPage() {
  let summary;
  try {
    summary = await api.points.summary();
  } catch {
    return (
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center text-slate-500 text-sm">
        Failed to load points summary.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Points</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Total estimated value:{" "}
            <span className="text-emerald-400 font-semibold">
              {fmt(summary.total_estimated_value_dollars)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white tabular-nums">
            {fmt(summary.total_estimated_value_dollars)}
          </span>
        </div>
      </div>

      {summary.programs.length === 0 && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 border-dashed p-12 text-center">
          <Star className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            No points data yet — link accounts and run a sync to get started.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.programs.map((p) => {
          const accent = PROGRAM_ACCENTS[p.program] ?? { bar: "bg-indigo-500", badge: "text-indigo-400" };
          return (
            <div
              key={p.program}
              className={cn(
                "rounded-xl border p-5 space-y-4",
                p.above_threshold
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-slate-800 bg-slate-900"
              )}
            >
              {/* Program name + value */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-100">{p.program}</p>
                  {p.above_threshold && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Bell className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-amber-400 font-medium">Ready to redeem</span>
                    </div>
                  )}
                </div>
                <p className={cn("text-xl font-bold tabular-nums", accent.badge)}>
                  {fmt(p.estimated_value_dollars)}
                </p>
              </div>

              {/* Stats */}
              <div className="space-y-1.5 text-sm">
                {p.manual_balance !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Balance</span>
                    <span className="font-mono font-medium text-slate-200 tabular-nums">
                      {p.manual_balance.toLocaleString()} pts
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Earned (90d)</span>
                  <span className="font-mono font-medium text-slate-200 tabular-nums">
                    {Math.round(p.points_earned_90d).toLocaleString()} pts
                  </span>
                </div>
                {p.redemption_threshold && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Threshold</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {p.redemption_threshold.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {p.redemption_threshold && (
                <div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", accent.bar)}
                      style={{
                        width: `${Math.min(
                          ((p.manual_balance ?? p.points_earned_90d) / p.redemption_threshold) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {p.above_threshold
                      ? "Above redemption threshold"
                      : `${(p.redemption_threshold - (p.manual_balance ?? p.points_earned_90d)).toLocaleString()} pts to threshold`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600">
        Point values are estimates based on typical transfer partner redemptions. Enter manual balances via the API to track exact totals.
      </p>
    </div>
  );
}
