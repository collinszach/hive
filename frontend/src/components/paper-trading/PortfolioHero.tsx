import { fmt } from "@/lib/utils";
import type { PaperPortfolio, PaperEvaluationReport } from "@/lib/api";

function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  const v = x * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function PortfolioHero({
  portfolio,
  report,
}: {
  portfolio: PaperPortfolio;
  report: PaperEvaluationReport | null;
}) {
  const value = report?.final_value ?? portfolio.current_cash;
  const left = daysLeft(portfolio.evaluation_ends_at);

  const stats: { label: string; value: string; tone?: "up" | "down" | "blue" }[] = [
    { label: "Total return", value: pct(report?.total_return), tone: (report?.total_return ?? 0) >= 0 ? "up" : "down" },
    { label: "vs SPY (alpha)", value: pct(report?.alpha), tone: (report?.alpha ?? 0) >= 0 ? "up" : "down" },
    { label: "Sharpe", value: report?.sharpe != null ? report.sharpe.toFixed(2) : "—", tone: "blue" },
    { label: "Cash", value: fmt(portfolio.current_cash), tone: "blue" },
  ];

  return (
    <div className="rounded-xl border border-blue bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary">
            {portfolio.name} · paper portfolio
          </div>
          <div className="mt-1 font-mono tabular-nums text-4xl font-semibold text-ink-primary">
            {fmt(value)}
          </div>
          <div className="mt-1 text-[12px] text-ink-tertiary">
            Benchmark {portfolio.benchmark_symbol} · simulated, no real money
          </div>
        </div>
        {left !== null && (
          <div className="text-right">
            <div className="font-mono tabular-nums text-2xl font-semibold text-blue">{left}</div>
            <div className="text-[11px] text-ink-tertiary">days left of {report?.days_target ?? 180}</div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border-subtle bg-base p-3">
            <div className="text-[11px] text-ink-tertiary">{s.label}</div>
            <div
              className={`mt-0.5 font-mono tabular-nums text-lg font-semibold ${
                s.tone === "up"
                  ? "text-semantic-income"
                  : s.tone === "down"
                    ? "text-semantic-expense"
                    : "text-ink-primary"
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
