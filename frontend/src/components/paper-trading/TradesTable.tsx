import { fmt } from "@/lib/utils";
import type { PaperTrade } from "@/lib/api";

export function TradesTable({ trades }: { trades: PaperTrade[] }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      <div className="mb-4 text-sm font-semibold text-ink-primary">Trades</div>
      {trades.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-ink-tertiary">
          No simulated trades yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-ink-tertiary">
                <th className="pb-2 text-left font-medium">Date</th>
                <th className="pb-2 text-left font-medium">Symbol</th>
                <th className="pb-2 text-left font-medium">Side</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-border-subtle">
                  <td className="py-2 font-mono tabular-nums text-ink-tertiary">{t.as_of}</td>
                  <td className="py-2 font-mono font-semibold text-ink-primary">{t.symbol}</td>
                  <td
                    className={`py-2 font-semibold uppercase ${
                      t.side === "buy" ? "text-semantic-income" : "text-semantic-expense"
                    }`}
                  >
                    {t.side}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-ink-secondary">
                    {t.quantity.toFixed(4)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-ink-secondary">
                    {fmt(t.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
