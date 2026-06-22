import type { PaperSignal } from "@/lib/api";

function labelTone(label: string): string {
  if (label === "buy") return "text-semantic-income";
  if (label === "sell") return "text-semantic-expense";
  return "text-ink-tertiary";
}

export function SignalsTable({ signals }: { signals: PaperSignal[] }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      <div className="mb-4 text-sm font-semibold text-ink-primary">Latest signals</div>
      {signals.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-ink-tertiary">
          No live signals yet. They generate daily for your watchlist.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-ink-tertiary">
                <th className="pb-2 text-left font-medium">Symbol</th>
                <th className="pb-2 text-left font-medium">Signal</th>
                <th className="pb-2 text-right font-medium">Score</th>
                <th className="pb-2 text-right font-medium">Confidence</th>
                <th className="pb-2 text-right font-medium">Regime</th>
                <th className="pb-2 text-right font-medium">As of</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={`${s.symbol}-${s.as_of}`} className="border-t border-border-subtle">
                  <td className="py-2 font-mono font-semibold text-ink-primary">{s.symbol}</td>
                  <td className={`py-2 font-semibold uppercase ${labelTone(s.signal_label)}`}>
                    {s.signal_label}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-ink-secondary">
                    {s.signal_score.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-ink-secondary">
                    {(s.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 text-right text-ink-tertiary">{s.regime_label ?? "—"}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-ink-tertiary">{s.as_of}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
