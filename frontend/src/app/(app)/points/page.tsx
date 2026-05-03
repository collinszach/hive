"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { api, PointsSummary, LedgerEntry, LeakageResponse } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import { POINT_VALUES_CPP } from "@/lib/pointsConstants";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TimeWindowPicker } from "./_components/TimeWindowPicker";
import { ProgramCard } from "./_components/ProgramCard";
import { EarnActivity } from "./_components/EarnActivity";
import { LeakageSummary } from "./_components/LeakageSummary";
import { TransferPartners } from "./_components/TransferPartners";
import { PageHero } from "@/components/PageHero";

type Tab = "overview" | "partners";

export default function PointsPage() {
  const searchParams                        = useSearchParams();
  const programParam                        = searchParams.get("program");
  const [tab, setTab]                       = useState<Tab>("overview");
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
  const [earnFilter, setEarnFilter]         = useState<string[]>(programParam ? [programParam] : []);
  const [trendData, setTrendData]           = useState<{ month: string; [program: string]: string | number }[]>([]);
  const [thresholds, setThresholds]         = useState<Record<string, number>>({});
  const [trendPrograms, setTrendPrograms]   = useState<string[]>([]);
  const earnActivityRef                     = useRef<HTMLDivElement>(null);

  // Scroll to earn activity section when arriving via ?program= deep link
  useEffect(() => {
    if (programParam && earnActivityRef.current) {
      setTimeout(() => earnActivityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, [programParam]);

  const fetchData = useCallback(async (d: number) => {
    setSummaryLoading(true);
    setLedgerLoading(true);
    setLeakageLoading(true);
    setSummaryError(false);
    setLedgerError(false);
    setLeakageError(false);

    const [summaryResult, ledgerResult, leakageResult, trendResult, threshResult] = await Promise.allSettled([
      api.points.summary(d),
      api.points.ledger({ days: d }),
      api.points.leakage(d),
      api.points.monthlyTrend(12),
      api.points.thresholds(),
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

    // Process trend data: pivot from [{month, program, points}] to [{month, "Amex MR": N, "Chase UR": N, ...}]
    if (trendResult.status === "fulfilled") {
      const raw = trendResult.value;
      const programs = [...new Set(raw.map((r) => r.program))].sort();
      setTrendPrograms(programs);
      const byMonth: Record<string, Record<string, number>> = {};
      for (const r of raw) {
        if (!byMonth[r.month]) byMonth[r.month] = {};
        byMonth[r.month][r.program] = r.points;
      }
      setTrendData(
        Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, vals]) => ({ month, ...vals }))
      );
    }

    if (threshResult.status === "fulfilled") {
      setThresholds(threshResult.value.thresholds);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  function handleViewActivity(program: string) {
    setEarnFilter([program]);
    setTimeout(() => earnActivityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function handleBalanceUpdate(program: string, balance: number) {
    if (!summary) return;
    const cpp = POINT_VALUES_CPP[program] ?? 1.0;
    const newEstValue = parseFloat((balance * cpp / 100).toFixed(2));
    const updatedPrograms = summary.programs.map((p) =>
      p.program === program
        ? {
            ...p,
            manual_balance: balance,
            estimated_value_dollars: newEstValue,
          }
        : p
    );
    const newTotal = parseFloat(
      updatedPrograms.reduce((sum, p) => sum + p.estimated_value_dollars, 0).toFixed(2)
    );
    setSummary({ ...summary, programs: updatedPrograms, total_estimated_value_dollars: newTotal });
  }

  if (summaryError && !summaryLoading && tab === "overview") {
    return (
      <div className="hive-card p-10 text-center text-ink-tertiary text-[13px]">
        Failed to load points summary.
      </div>
    );
  }

  const totalValue   = summary?.total_estimated_value_dollars ?? 0;
  const programCount = summary?.programs.length ?? 0;
  const earned90d    = summary?.programs.reduce((s, p) => s + p.points_earned_90d, 0) ?? 0;
  const bestProgram  = summary?.programs.reduce(
    (best, p) => (p.estimated_value_dollars > (best?.estimated_value_dollars ?? 0) ? p : best),
    null as (typeof summary.programs)[0] | null
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── PageHero ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <PageHero
            eyebrow="Points & Rewards"
            headline={<span className="text-honey">{summaryLoading ? "—" : fmt(totalValue)}</span>}
            subtext="estimated redemption value across all programs"
            glow="amber"
            statStrip={[
              { label: "Programs",        value: `${programCount} program${programCount !== 1 ? "s" : ""}`,                color: "default" },
              { label: `${days}d Earned`, value: summaryLoading ? "—" : `${Math.round(earned90d).toLocaleString()} pts`,   color: "amber"   },
              { label: "Best Card",       value: bestProgram?.program ?? "—",                                              color: "default" },
            ]}
          />
        </div>
        {tab === "overview" && (
          <div className="shrink-0 pt-1">
            <TimeWindowPicker value={days} onChange={setDays} />
          </div>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-elevated rounded-xl p-1 w-fit">
        {([
          { key: "overview",  label: "Overview"           },
          { key: "partners",  label: "Transfer Partners"  },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
              tab === key
                ? "bg-white/[0.08] text-ink-primary"
                : "text-ink-tertiary hover:text-ink-secondary"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      {tab === "overview" ? (
        <>
          {/* Program Cards */}
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
              <p className="text-[12px] text-ink-tertiary">Link accounts and run a sync to get started.</p>
            </div>
          )}

          {!summaryLoading && summary && summary.programs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.programs.map((p) => (
                <ProgramCard key={p.program} program={p} onBalanceUpdate={handleBalanceUpdate} onViewActivity={handleViewActivity} threshold={thresholds[p.program]} />
              ))}
            </div>
          )}

          {/* Points Earning Trend */}
          {trendData.length > 1 && (
            <div className="hive-card p-5">
              <p className="text-[13px] font-medium text-ink-primary mb-4">Monthly Points Earned</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickFormatter={(v: string) => {
                      const [, m] = v.split("-");
                      return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m, 10) - 1] ?? v;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} width={50} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: "#1A1B23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9CA3AF" }}
                    formatter={(value: number, name: string) => [`${value.toLocaleString()} pts`, name]}
                  />
                  {trendPrograms.map((prog, i) => (
                    <Line
                      key={prog}
                      type="monotone"
                      dataKey={prog}
                      name={prog}
                      stroke={["#10B981", "#38BDF8", "#F59E0B", "#A78BFA", "#EC4899"][i % 5]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Earn Activity */}
          <div ref={earnActivityRef}>
            <EarnActivity ledger={ledger} loading={ledgerLoading} error={ledgerError} filterPrograms={earnFilter} onFilterProgramsChange={setEarnFilter} />
          </div>

          {/* Leakage */}
          <LeakageSummary data={leakage} loading={leakageLoading} error={leakageError} />

          <p className="text-[11px] text-ink-tertiary/50">
            Values are estimates based on typical transfer partner redemptions. Actual redemption value may vary.
          </p>
        </>
      ) : (
        <TransferPartners />
      )}
    </div>
  );
}
