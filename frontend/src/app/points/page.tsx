"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Star } from "lucide-react";
import { api, PointsSummary, LedgerEntry, LeakageResponse } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { POINT_VALUES_CPP, REDEMPTION_THRESHOLDS } from "@/lib/pointsConstants";
import { TimeWindowPicker } from "./_components/TimeWindowPicker";
import { ProgramCard } from "./_components/ProgramCard";
import { EarnActivity } from "./_components/EarnActivity";
import { LeakageSummary } from "./_components/LeakageSummary";

export default function PointsPage() {
  const [days, setDays]                     = useState<number>(90);
  const [summary, setSummary]               = useState<PointsSummary | null>(null);
  const [ledger, setLedger]                 = useState<LedgerEntry[]>([]);
  const [leakage, setLeakage]               = useState<LeakageResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading]   = useState(true);
  const [leakageLoading, setLeakageLoading] = useState(true);
  const [summaryError, setSummaryError]     = useState(false);
  const [ledgerError, setLedgerError]       = useState(false);
  const [leakageError, setLeakageError]     = useState(false);

  const fetchData = useCallback(async (d: number) => {
    setSummaryLoading(true);
    setLedgerLoading(true);
    setLeakageLoading(true);
    setSummaryError(false);
    setLedgerError(false);
    setLeakageError(false);

    const [summaryResult, ledgerResult, leakageResult] = await Promise.allSettled([
      api.points.summary(d),
      api.points.ledger({ days: d }),
      api.points.leakage(d),
    ]);

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
    } else {
      setSummaryError(true);
    }
    setSummaryLoading(false);

    if (ledgerResult.status === "fulfilled") {
      setLedger(ledgerResult.value);
    } else {
      setLedgerError(true);
    }
    setLedgerLoading(false);

    if (leakageResult.status === "fulfilled") {
      setLeakage(leakageResult.value);
    } else {
      setLeakageError(true);
    }
    setLeakageLoading(false);
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  function handleBalanceUpdate(program: string, balance: number) {
    if (!summary) return;
    const cpp = POINT_VALUES_CPP[program] ?? 1.0;
    const threshold = REDEMPTION_THRESHOLDS[program];
    const newEstValue = parseFloat((balance * cpp / 100).toFixed(2));
    const updatedPrograms = summary.programs.map((p) =>
      p.program === program
        ? {
            ...p,
            manual_balance: balance,
            estimated_value_dollars: newEstValue,
            above_threshold: threshold !== undefined && balance >= threshold,
          }
        : p
    );
    const newTotal = parseFloat(
      updatedPrograms.reduce((sum, p) => sum + p.estimated_value_dollars, 0).toFixed(2)
    );
    setSummary({ ...summary, programs: updatedPrograms, total_estimated_value_dollars: newTotal });
  }

  if (summaryError && !summaryLoading) {
    return (
      <div className="hive-card p-10 text-center text-ink-tertiary text-[13px]">
        Failed to load points summary.
      </div>
    );
  }

  const totalValue = summary?.total_estimated_value_dollars ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Points</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">Estimated portfolio value across all programs</p>
        </div>
        <div className="flex items-center gap-3">
          <TimeWindowPicker value={days} onChange={setDays} />
          <div className="flex items-center gap-2 hive-card px-4 py-2.5">
            <TrendingUp className="w-4 h-4 text-semantic-income" />
            <span className="text-[15px] font-semibold font-mono text-semantic-income tabular-nums">
              {summaryLoading ? "—" : fmt(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Program Cards ──────────────────────────────────────────── */}
      {summaryLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="hive-card p-5 h-44 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!summaryLoading && summary && summary.programs.length === 0 && (
        <div className="hive-card p-16 text-center border-dashed">
          <Star className="w-8 h-8 text-ink-tertiary/30 mx-auto mb-3" />
          <p className="text-[14px] text-ink-secondary mb-1">No points data yet</p>
          <p className="text-[12px] text-ink-tertiary">
            Link accounts and run a sync to get started.
          </p>
        </div>
      )}

      {!summaryLoading && summary && summary.programs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summary.programs.map((p) => (
            <ProgramCard
              key={p.program}
              program={p}
              onBalanceUpdate={handleBalanceUpdate}
            />
          ))}
        </div>
      )}

      {/* ── Earn Activity ──────────────────────────────────────────── */}
      <EarnActivity
        ledger={ledger}
        loading={ledgerLoading}
        error={ledgerError}
      />

      {/* ── Missed Earnings / Leakage ──────────────────────────────── */}
      <LeakageSummary
        data={leakage}
        loading={leakageLoading}
        error={leakageError}
      />

      <p className="text-[11px] text-ink-tertiary/50">
        Values are estimates based on typical transfer partner redemptions. Actual redemption value may vary.
      </p>
    </div>
  );
}
