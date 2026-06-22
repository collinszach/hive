"use client";

import { useEffect, useState, useCallback } from "react";
import { FlaskConical } from "lucide-react";
import {
  api,
  type PaperPortfolio,
  type PaperEvaluationReport,
  type PaperPerformancePoint,
  type PaperSignal,
  type PaperTrade,
  type PaperWatchlistSymbol,
  type PaperBacktestRun,
} from "@/lib/api";
import { PortfolioHero } from "@/components/paper-trading/PortfolioHero";
import { PerformanceChart } from "@/components/paper-trading/PerformanceChart";
import { SignalsTable } from "@/components/paper-trading/SignalsTable";
import { TradesTable } from "@/components/paper-trading/TradesTable";
import { WatchlistEditor } from "@/components/paper-trading/WatchlistEditor";
import { EvaluationReportCard } from "@/components/paper-trading/EvaluationReportCard";
import { BacktestReportCard } from "@/components/paper-trading/BacktestReportCard";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default function PaperTradingPage() {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
  const [report, setReport] = useState<PaperEvaluationReport | null>(null);
  const [performance, setPerformance] = useState<PaperPerformancePoint[]>([]);
  const [signals, setSignals] = useState<PaperSignal[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [watchlist, setWatchlist] = useState<PaperWatchlistSymbol[]>([]);
  const [backtest, setBacktest] = useState<PaperBacktestRun | null>(null);
  const [creating, setCreating] = useState(false);
  const [backtestQueued, setBacktestQueued] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Signals, watchlist, and backtest history exist regardless of a portfolio.
    const [wl, sig, runs] = await Promise.all([
      api.paperTrading.watchlist().catch(() => []),
      api.paperTrading.signals().catch(() => []),
      api.paperTrading.listBacktests(1).catch(() => [] as PaperBacktestRun[]),
    ]);
    setWatchlist(wl);
    setSignals(sig);
    setBacktest(runs[0] ?? null);

    try {
      const pf = await api.paperTrading.getPortfolio();
      setPortfolio(pf);
      const [perf, tr, rep] = await Promise.all([
        api.paperTrading.performance().catch(() => []),
        api.paperTrading.trades().catch(() => []),
        api.paperTrading.report().catch(() => null),
      ]);
      setPerformance(perf);
      setTrades(tr);
      setReport(rep);
    } catch {
      setPortfolio(null); // 404 — no portfolio yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createPortfolio() {
    setCreating(true);
    try {
      const pf = await api.paperTrading.createPortfolio({ name: "Signal Engine", starting_cash: 100000 });
      setPortfolio(pf);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function runBacktest() {
    const symbols = watchlist.map((w) => w.symbol);
    if (symbols.length === 0) return;
    setBacktestQueued(true);
    try {
      // Validation = last 6 months (the forward window's analogue); training = the ~2 years before it.
      await api.paperTrading.startBacktest({
        symbols,
        validation_end: isoDaysAgo(0),
        validation_start: isoDaysAgo(180),
        train_end: isoDaysAgo(181),
        train_start: isoDaysAgo(181 + 730),
      });
    } catch {
      setBacktestQueued(false);
    }
  }

  const backtestSection = (
    <div className="space-y-3">
      {backtest ? (
        <BacktestReportCard run={backtest} />
      ) : (
        <div className="rounded-xl border border-border-subtle bg-surface p-6">
          <div className="text-sm font-semibold text-ink-primary">Backtest the strategy first</div>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-tertiary">
            Learn parameters on historical data and prove them out-of-sample before trading forward. Runs in
            the background — refresh in a few minutes to see the result.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={runBacktest}
        disabled={backtestQueued || watchlist.length === 0}
        className="inline-flex items-center gap-2 rounded-lg border border-blue px-4 py-2 text-[13px] font-semibold text-blue disabled:opacity-50"
        title={watchlist.length === 0 ? "Add a watchlist symbol first" : undefined}
      >
        {backtestQueued ? "Backtest queued — refresh shortly" : backtest ? "Re-run backtest" : "Run backtest"}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue bg-surface text-blue">
          <FlaskConical size={18} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Paper Trading</h1>
          <p className="text-[12px] text-ink-tertiary">
            AI/ML signal engine in a sandboxed virtual portfolio — simulated, no real money.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-border-subtle bg-surface p-10 text-center text-[13px] text-ink-tertiary">
          Loading…
        </div>
      ) : !portfolio ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-blue bg-surface p-6">
            <div className="text-sm font-semibold text-ink-primary">No paper portfolio yet</div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-tertiary">
              Build a watchlist, then start a virtual portfolio. The engine generates daily signals from
              technical indicators + ML regime detection and trades them in simulation against real market
              data for a 6-month evaluation.
            </p>
            <button
              type="button"
              onClick={createPortfolio}
              disabled={creating}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {creating ? "Creating…" : "Start paper portfolio"}
            </button>
          </div>
          <WatchlistEditor initial={watchlist} onChange={setWatchlist} />
          {backtestSection}
          <SignalsTable signals={signals} />
        </div>
      ) : (
        <div className="space-y-5">
          <PortfolioHero portfolio={portfolio} report={report} />
          <PerformanceChart data={performance} />
          {report && <EvaluationReportCard report={report} />}
          {backtestSection}
          <div className="grid gap-5 lg:grid-cols-2">
            <SignalsTable signals={signals} />
            <TradesTable trades={trades} />
          </div>
          <WatchlistEditor initial={watchlist} onChange={setWatchlist} />
        </div>
      )}
    </div>
  );
}
