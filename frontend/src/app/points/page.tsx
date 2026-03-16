import { api } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const revalidate = 60;

export default async function PointsPage() {
  let summary;
  try {
    summary = await api.points.summary();
  } catch {
    return (
      <div className="text-gray-500 text-sm">Failed to load points summary.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Points</h1>
        <p className="text-sm text-gray-500 mt-1">
          Total estimated value:{" "}
          <span className="text-emerald-400 font-semibold">
            {fmt(summary.total_estimated_value_dollars)}
          </span>
        </p>
      </div>

      {summary.programs.length === 0 && (
        <p className="text-sm text-gray-500">
          No points data yet — link accounts and run a sync to get started.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.programs.map((p) => (
          <div
            key={p.program}
            className={cn(
              "rounded-xl border p-5 space-y-3",
              p.above_threshold
                ? "border-yellow-600/50 bg-yellow-900/10"
                : "border-gray-800 bg-gray-900"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{p.program}</p>
                {p.above_threshold && (
                  <span className="text-xs text-yellow-400 font-medium">
                    Ready to redeem!
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-emerald-400">
                {fmt(p.estimated_value_dollars)}
              </p>
            </div>

            <div className="space-y-1 text-sm">
              {p.manual_balance !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Balance</span>
                  <span className="font-mono">{p.manual_balance.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Earned (90d)</span>
                <span className="font-mono">{Math.round(p.points_earned_90d).toLocaleString()}</span>
              </div>
              {p.redemption_threshold && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Redeem threshold</span>
                  <span className="font-mono">{p.redemption_threshold.toLocaleString()}</span>
                </div>
              )}
            </div>

            {p.redemption_threshold && (
              <div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-1.5 rounded-full", p.above_threshold ? "bg-yellow-400" : "bg-indigo-500")}
                    style={{
                      width: `${Math.min(
                        ((p.manual_balance ?? p.points_earned_90d) / p.redemption_threshold) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {p.above_threshold
                    ? "Above redemption threshold"
                    : `${(p.redemption_threshold - (p.manual_balance ?? p.points_earned_90d)).toLocaleString()} to threshold`}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600">
        Point values are estimates based on typical transfer partner redemptions. Enter manual balances via the API to track exact totals.
      </p>
    </div>
  );
}
