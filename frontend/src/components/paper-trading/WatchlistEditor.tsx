"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { api, type PaperWatchlistSymbol } from "@/lib/api";

export function WatchlistEditor({
  initial,
  onChange,
}: {
  initial: PaperWatchlistSymbol[];
  onChange?: (symbols: PaperWatchlistSymbol[]) => void;
}) {
  const [symbols, setSymbols] = useState<PaperWatchlistSymbol[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  function commit(next: PaperWatchlistSymbol[]) {
    setSymbols(next);
    onChange?.(next);
  }

  async function add() {
    const sym = input.trim().toUpperCase();
    if (!sym || busy) return;
    setBusy(true);
    try {
      const added = await api.paperTrading.addSymbol(sym);
      if (!symbols.some((s) => s.symbol === added.symbol)) commit([...symbols, added]);
      setInput("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(sym: string) {
    setBusy(true);
    try {
      await api.paperTrading.removeSymbol(sym);
      commit(symbols.filter((s) => s.symbol !== sym));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      <div className="mb-4 text-sm font-semibold text-ink-primary">Watchlist</div>
      <div className="flex flex-wrap gap-2">
        {symbols.map((s) => (
          <span
            key={s.symbol}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-base px-2 py-1 font-mono text-[12px] text-ink-secondary"
          >
            {s.symbol}
            <button
              type="button"
              onClick={() => remove(s.symbol)}
              disabled={busy}
              className="text-ink-tertiary hover:text-blue"
              aria-label={`Remove ${s.symbol}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {symbols.length === 0 && (
          <span className="text-[13px] text-ink-tertiary">No symbols yet — add a few tickers.</span>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add ticker (e.g. AAPL)"
          className="flex-1 rounded-lg border border-border-subtle bg-base px-3 py-2 font-mono text-[13px] uppercase text-ink-primary outline-none focus:border-blue"
          maxLength={12}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-blue px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}
