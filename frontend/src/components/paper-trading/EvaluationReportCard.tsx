import { fmt } from "@/lib/utils";
import type { PaperEvaluationReport } from "@/lib/api";

function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
}

export function EvaluationReportCard({ report }: { report: PaperEvaluationReport }) {
  const metrics: { label: string; value: string; tone?: "up" | "down" }[] = [
    { label: "Total return", value: pct(report.total_return), tone: (report.total_return ?? 0) >= 0 ? "up" : "down" },
    { label: "CAGR", value: pct(report.cagr) },
    { label: "Benchmark", value: pct(report.benchmark_return) },
    { label: "Alpha (raw)", value: pct(report.alpha), tone: (report.alpha ?? 0) >= 0 ? "up" : "down" },
    { label: "Alpha (ann., β-adj)", value: pct(report.alpha_annualized), tone: (report.alpha_annualized ?? 0) >= 0 ? "up" : "down" },
    { label: "Beta", value: report.beta != null ? report.beta.toFixed(2) : "—" },
    { label: "Sharpe", value: report.sharpe != null ? report.sharpe.toFixed(2) : "—" },
    { label: "Benchmark Sharpe", value: report.benchmark_sharpe != null ? report.benchmark_sharpe.toFixed(2) : "—" },
    { label: "Max drawdown", value: pct(report.max_drawdown), tone: "down" },
    { label: "Win rate", value: report.win_rate != null ? `${(report.win_rate * 100).toFixed(0)}%` : "—" },
    { label: "Avg win", value: report.avg_win != null ? fmt(report.avg_win) : "—", tone: "up" },
    { label: "Avg loss", value: report.avg_loss != null ? fmt(report.avg_loss) : "—", tone: "down" },
    { label: "Trades closed", value: String(report.trades_closed) },
  ];

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-primary">Evaluation report</div>
        <span className="rounded-md border border-blue px-2 py-0.5 font-mono text-[11px] text-blue">
          {report.status === "complete" ? "complete" : `day ${report.days_elapsed}/${report.days_target}`}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border-subtle bg-base p-3">
            <div className="text-[11px] text-ink-tertiary">{m.label}</div>
            <div
              className={`mt-0.5 font-mono tabular-nums text-[15px] font-semibold ${
                m.tone === "up"
                  ? "text-semantic-income"
                  : m.tone === "down"
                    ? "text-semantic-expense"
                    : "text-ink-primary"
              }`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
        Simulated results from a virtual portfolio. Not investment advice and not a prediction of future
        returns.
      </p>
    </div>
  );
}
