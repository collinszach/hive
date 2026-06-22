import type { PaperBacktestRun } from "@/lib/api";

function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
}

function num(x: number | null | undefined): string {
  return x != null ? x.toFixed(2) : "—";
}

/**
 * Shows train vs. validation side by side — the whole point of the train/validation split:
 * the strategy was learned on one window and proven on a later, untouched one.
 */
export function BacktestReportCard({ run }: { run: PaperBacktestRun }) {
  return (
    <div className="rounded-xl border border-blue bg-surface p-6">
      <div className="text-sm font-semibold text-ink-primary">What the engine learned</div>
      <div className="mt-1 text-[12px] text-ink-tertiary">
        Tuned on {run.train_start} → {run.train_end}, then scored once on the untouched window{" "}
        {run.validation_start} → {run.validation_end}.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-subtle bg-base p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary">Training</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[12px] text-ink-tertiary">Sharpe</span>
            <span className="font-mono tabular-nums text-lg font-semibold text-ink-secondary">
              {num(run.train_sharpe)}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-blue bg-base p-4">
          <div className="text-[11px] uppercase tracking-wide text-blue">Validation (out-of-sample)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[12px] text-ink-tertiary">Sharpe</span>
            <span className="font-mono tabular-nums text-lg font-semibold text-ink-primary">
              {num(run.validation_sharpe)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[12px] text-ink-tertiary">Return</span>
            <span
              className={`font-mono tabular-nums text-sm font-semibold ${
                (run.validation_total_return ?? 0) >= 0 ? "text-semantic-income" : "text-semantic-expense"
              }`}
            >
              {pct(run.validation_total_return)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[12px] text-ink-tertiary">vs benchmark</span>
            <span
              className={`font-mono tabular-nums text-sm font-semibold ${
                (run.validation_vs_benchmark ?? 0) >= 0 ? "text-semantic-income" : "text-semantic-expense"
              }`}
            >
              {pct(run.validation_vs_benchmark)}
            </span>
          </div>
        </div>
      </div>

      {run.selected_params && (
        <div className="mt-3 rounded-lg border border-border-subtle bg-base p-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary">Selected parameters</div>
          <div className="mt-1 font-mono text-[12px] text-ink-secondary">
            {Object.entries(run.selected_params)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join("  ·  ")}
          </div>
        </div>
      )}
    </div>
  );
}
