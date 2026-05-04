"use client";

import { useEffect, useState, useRef } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, type NetWorthSnapshot } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

// ── Animated counter ──────────────────────────────────────────────────────────

function useAnimatedNumber(target: number | null, duration = 1100) {
  const [value, setValue] = useState<number | null>(null);
  const fromRef    = useRef<number>(0);
  const rafRef     = useRef<number>(0);

  useEffect(() => {
    if (target === null) return;
    const from = fromRef.current;
    const to   = target;
    fromRef.current = to;
    cancelAnimationFrame(rafRef.current);
    let startTime: number | null = null;

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 5); // ease-out-quint
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "rgba(10,11,16,0.95)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "10px 14px",
      backdropFilter: "blur(16px)",
      pointerEvents: "none",
    }}>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        {d.date}
      </p>
      <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "var(--font-mono)", marginBottom: 4 }}>
        {fmt(d.net_worth)}
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <span style={{ fontSize: 11, color: "#3DD68C" }}>↑ {fmt(d.assets)}</span>
        <span style={{ fontSize: 11, color: "#F87171" }}>↓ {fmt(d.liabilities)}</span>
      </div>
    </div>
  );
}

interface ChartRow { date: string; net_worth: number; assets: number; liabilities: number; }

const RANGES = [
  { label: "1M",  days: 30  as const },
  { label: "3M",  days: 90  as const },
  { label: "6M",  days: 180 as const },
  { label: "1Y",  days: 365 as const },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const [data,    setData]    = useState<NetWorthSnapshot[]>([]);
  const [allData, setAllData] = useState<NetWorthSnapshot[]>([]);
  const [range,   setRange]   = useState<30 | 90 | 180 | 365>(90);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.netWorth.history(range)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  // Load full history once for milestone tracking (1825 days max = ~5 years)
  useEffect(() => {
    api.netWorth.history(1825).then(setAllData).catch(() => {});
  }, []);

  const latest   = data[data.length - 1] ?? null;
  const earliest = data[0] ?? null;

  const netWorth  = latest?.net_worth ?? null;
  const change    = latest && earliest ? latest.net_worth - earliest.net_worth : null;
  const changePct = earliest && change !== null && earliest.net_worth !== 0
    ? (change / Math.abs(earliest.net_worth)) * 100
    : null;

  const animated   = useAnimatedNumber(netWorth);
  const isPositive = (change ?? 0) >= 0;
  const accentRgb  = isPositive ? "90,168,106" : "200,90,90";
  const accent     = isPositive ? "#3DD68C" : "#F87171";

  const chartData: ChartRow[] = data.map(s => ({
    date:        fmtDate(s.snapshot_date),
    net_worth:   Math.round(s.net_worth),
    assets:      Math.round(s.total_assets),
    liabilities: Math.round(s.total_liabilities),
  }));

  // Account breakdown from latest snapshot (if available)
  const breakdown = (latest as (NetWorthSnapshot & { breakdown?: Record<string, number> }))?.breakdown ?? {};
  const assetRows = Object.entries(breakdown).filter(([, v]) => v >= 0).sort(([, a], [, b]) => b - a);
  const liabRows  = Object.entries(breakdown).filter(([, v]) => v <  0).sort(([, a], [, b]) => a - b);

  return (
    <>
      <style>{`
        @keyframes nw-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nw-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .nw-fade-up { animation: nw-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .nw-fade-up-d1 { animation-delay: 0.08s; }
        .nw-fade-up-d2 { animation-delay: 0.16s; }
        .nw-fade-up-d3 { animation-delay: 0.24s; }
      `}</style>

      <div style={{ position: "relative", minHeight: "100%", overflow: "hidden", paddingBottom: 60 }}>

        {/* Background removed — clean layout */}

        {/* ── Header ── */}
        <div style={{ padding: "28px 28px 0" }}>
          <p style={{
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color:         "rgba(255,255,255,0.2)",
            marginBottom:  4,
          }}>
            Net Worth
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>
            Balance sheet · updated daily
          </p>
        </div>

        {/* ── Giant number hero ── */}
        <div className="hive-card-hero" style={{ margin: "24px 28px", padding: "32px 28px 24px", textAlign: "center" }}>
          {loading ? (
            <div style={{ height: 108, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.06)",
                borderTopColor: "rgba(255,255,255,0.25)",
                animation: "nw-spin 0.9s linear infinite",
              }} />
            </div>
          ) : error ? (
            <p style={{ fontSize: 14, color: "#F87171", fontFamily: "var(--font-mono)" }}>{error}</p>
          ) : animated !== null ? (
            <>
              {/* The number */}
              <p
                className="nw-fade-up"
                style={{
                  fontFamily:  "var(--font-mono)",
                  fontSize:    "clamp(42px, 7vw, 72px)",
                  fontWeight:  700,
                  color:       "#fff",
                  lineHeight:  1,
                  letterSpacing: "-0.02em",
                  marginBottom: 22,
                  transition:  "text-shadow 1s ease",
                }}
              >
                {fmt(animated)}
              </p>

              {/* Change pill */}
              {change !== null && (
                <div
                  className="nw-fade-up nw-fade-up-d1"
                  style={{
                    display:    "inline-flex",
                    alignItems: "center",
                    gap:        8,
                    padding:    "7px 16px",
                    borderRadius: 100,
                    background: `rgba(${accentRgb}, 0.08)`,
                    border:     `1px solid rgba(${accentRgb}, 0.18)`,
                  }}
                >
                  {isPositive
                    ? <TrendingUp  size={12} color={accent} strokeWidth={2} />
                    : <TrendingDown size={12} color={accent} strokeWidth={2} />
                  }
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: accent,
                    fontFamily: "var(--font-mono)",
                  }}>
                    {change >= 0 ? "+" : ""}{fmt(change)}
                  </span>
                  {changePct !== null && (
                    <span style={{ fontSize: 11, color: `rgba(${accentRgb}, 0.55)`, fontFamily: "var(--font-mono)" }}>
                      {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                    this period
                  </span>
                </div>
              )}
            </>
          ) : (
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 56, fontWeight: 700,
              color: "rgba(255,255,255,0.1)",
            }}>—</p>
          )}
        </div>

        {/* ── Chart (borderless, atmospheric) ── */}
        <div className="nw-fade-up nw-fade-up-d2">
          {/* Period pills — live above the chart */}
          <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 12 }}>
            {RANGES.map(({ label, days }) => {
              const active = range === days;
              return (
                <button
                  key={days}
                  onClick={() => setRange(days)}
                  style={{
                    padding:      "5px 13px",
                    borderRadius: 8,
                    fontSize:     11,
                    fontWeight:   active ? 600 : 400,
                    fontFamily:   "var(--font-mono)",
                    color:        active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)",
                    background:   active ? "rgba(255,255,255,0.07)" : "transparent",
                    border:       active ? "1px solid rgba(255,255,255,0.09)" : "1px solid transparent",
                    cursor:       "pointer",
                    transition:   "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{
            height: 1,
            margin: "0 28px",
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          }} />

          {!loading && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 20, right: 28, left: 28, bottom: 4 }}>
                <defs>
                  <linearGradient id="nwAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={accent} stopOpacity={0.18} />
                    <stop offset="75%"  stopColor={accent} stopOpacity={0.03} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="net_worth"
                  stroke={accent}
                  strokeWidth={1.5}
                  fill="url(#nwAreaFill)"
                  dot={false}
                  activeDot={{ r: 3, fill: accent, stroke: "rgba(0,0,0,0.6)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : !loading ? (
            <div style={{
              height: 160,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              gap: 8,
            }}>
              <p style={{ fontSize: 32, color: "rgba(255,255,255,0.08)" }}>∅</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>No snapshots yet</p>
            </div>
          ) : null}

          <div style={{
            height: 1,
            margin: "0 28px",
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          }} />
        </div>

        {/* ── Assets / Liabilities panels ── */}
        {latest && (
          <div
            className="nw-fade-up nw-fade-up-d3"
            style={{
              display:             "grid",
              gridTemplateColumns: "1fr 1fr",
              gap:                 12,
              padding:             "24px 28px 0",
            }}
          >
            {/* Assets */}
            <div className="hive-card" style={{
              padding: "20px 20px 18px",
            }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.22em",
                textTransform: "uppercase", color: "rgba(61,214,140,0.45)", marginBottom: 10,
              }}>Assets</p>
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize: 24, fontWeight: 700, color: "#3DD68C",
                lineHeight: 1, marginBottom: 16,
              }}>
                {fmt(latest.total_assets)}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {assetRows.length > 0 ? assetRows.map(([name, value]) => (
                  <AccountRow key={name} name={name} value={value} color="rgba(61,214,140,0.6)" />
                )) : (
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>Link accounts to see breakdown</p>
                )}
              </div>
            </div>

            {/* Liabilities */}
            <div className="hive-card" style={{
              padding: "20px 20px 18px",
            }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.22em",
                textTransform: "uppercase", color: "rgba(248,113,113,0.45)", marginBottom: 10,
              }}>Liabilities</p>
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize: 24, fontWeight: 700, color: "#F87171",
                lineHeight: 1, marginBottom: 16,
              }}>
                {fmt(latest.total_liabilities)}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {liabRows.length > 0 ? liabRows.map(([name, value]) => (
                  <AccountRow key={name} name={name} value={Math.abs(value)} color="rgba(248,113,113,0.6)" />
                )) : (
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>
                    {latest.total_liabilities === 0 ? "Debt-free ✦" : "No breakdown available"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Divider bar — assets vs liabilities ratio ── */}
        {latest && latest.total_assets > 0 && (
          <div style={{ padding: "16px 28px 0" }}>
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              marginBottom:   6,
            }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Asset coverage ratio
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}>
                {latest.total_liabilities > 0
                  ? `${(latest.total_assets / latest.total_liabilities).toFixed(1)}×`
                  : "∞×"
                }
              </span>
            </div>
            <div style={{
              height: 3, borderRadius: 2,
              background: "rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                borderRadius: 2,
                background: "linear-gradient(90deg, #3DD68C, rgba(61,214,140,0.4))",
                width: `${Math.min(100, latest.total_liabilities > 0
                  ? (1 - latest.total_liabilities / latest.total_assets) * 100
                  : 100
                )}%`,
                transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }} />
            </div>
          </div>
        )}

        {/* ── Peer benchmarks ── */}
        <BenchmarkSection netWorth={netWorth} />

        {/* ── Milestones ── */}
        <MilestoneSection data={allData} currentNW={netWorth} />
      </div>
    </>
  );
}

// ── Milestones ────────────────────────────────────────────────────────────────

const MILESTONES = [10_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000];

function MilestoneSection({ data, currentNW }: { data: NetWorthSnapshot[]; currentNW: number | null }) {
  if (!currentNW || data.length < 2) return null;

  // Find first crossing date for each milestone
  const crossings: { threshold: number; date: string }[] = [];
  for (const m of MILESTONES) {
    if (currentNW < m * 0.3) break; // Skip if way below milestone
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1].net_worth < m && data[i].net_worth >= m) {
        crossings.push({ threshold: m, date: data[i].snapshot_date });
        break;
      }
    }
    // If first snapshot is already past milestone, use it
    if (data[0].net_worth >= m && !crossings.find(c => c.threshold === m)) {
      crossings.push({ threshold: m, date: data[0].snapshot_date });
    }
  }

  const nextMilestone = MILESTONES.find(m => currentNW < m);
  const prevMilestone = crossings[crossings.length - 1]?.threshold ?? 0;
  const progressToNext = nextMilestone && nextMilestone > prevMilestone
    ? Math.min(100, ((currentNW - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  if (crossings.length === 0 && !nextMilestone) return null;

  return (
    <div className="hive-card" style={{
      margin: "20px 28px 0",
      padding: "20px 22px",
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>
        Milestones
      </p>

      {/* Next milestone progress */}
      {nextMilestone && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "rgba(255,200,80,0.8)" }}>
              Next: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" }).format(nextMilestone)}
            </span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}>
              {progressToNext.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: "linear-gradient(90deg, rgba(255,200,80,0.6), rgba(255,200,80,0.3))",
              width: `${progressToNext}%`,
              transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
            }} />
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(nextMilestone - currentNW)} to go
          </p>
        </div>
      )}

      {/* Achieved milestones */}
      {crossings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...crossings].reverse().map(({ threshold, date }) => {
            const d = new Date(date + "T12:00:00");
            const label = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" }).format(threshold);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
            return (
              <div key={threshold} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "rgba(61,214,140,0.12)", border: "1px solid rgba(61,214,140,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 9, color: "#3DD68C" }}>✓</span>
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {label}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>
                  {dateStr}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SCF Benchmark data (Federal Reserve Survey of Consumer Finances, 2022) ────

const SCF_BRACKETS = [
  { label: "Under 35", min: 0,  max: 34,  median: 39_000,  mean: 183_500  },
  { label: "35–44",    min: 35, max: 44,  median: 135_600, mean: 549_600  },
  { label: "45–54",    min: 45, max: 54,  median: 247_200, mean: 975_800  },
  { label: "55–64",    min: 55, max: 64,  median: 364_500, mean: 1_566_900 },
  { label: "65–74",    min: 65, max: 74,  median: 409_900, mean: 1_794_600 },
  { label: "75+",      min: 75, max: 999, median: 335_600, mean: 1_624_100 },
] as const;

function BenchmarkBadge({ userNW, medianNW }: { userNW: number; medianNW: number }) {
  const pct = medianNW > 0 ? (userNW / medianNW) * 100 : 0;
  const ahead = userNW >= medianNW;
  const diff = Math.abs(userNW - medianNW);

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "6px 14px", borderRadius: 100,
      background: ahead ? "rgba(61,214,140,0.08)" : "rgba(248,113,113,0.08)",
      border: `1px solid ${ahead ? "rgba(61,214,140,0.18)" : "rgba(248,113,113,0.18)"}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: ahead ? "#3DD68C" : "#F87171", fontFamily: "var(--font-mono)" }}>
        {pct.toFixed(0)}%
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
        of median · {ahead ? "+" : "-"}{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(diff)} {ahead ? "ahead" : "behind"}
      </span>
    </div>
  );
}

function BenchmarkSection({ netWorth }: { netWorth: number | null }) {
  const [age, setAge] = useState<number>(32);
  const bracket = SCF_BRACKETS.find(b => age >= b.min && age <= b.max) ?? SCF_BRACKETS[0];
  const nw = netWorth ?? 0;
  const maxBar = Math.max(nw, bracket.median, bracket.mean, 1);

  return (
    <div className="hive-card" style={{
      margin: "20px 28px 0",
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>
            Benchmarks
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Federal Reserve SCF 2022 · age group {bracket.label}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Your age:</label>
          <input
            type="number"
            min={18}
            max={99}
            value={age}
            onChange={e => setAge(parseInt(e.target.value) || 32)}
            style={{
              width: 56, padding: "4px 8px", borderRadius: 7, fontSize: 13,
              fontFamily: "var(--font-mono)", fontWeight: 600,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.8)", textAlign: "center",
            }}
          />
        </div>
      </div>

      {netWorth !== null && <div style={{ marginBottom: 16 }}><BenchmarkBadge userNW={nw} medianNW={bracket.median} /></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "You",    value: nw,             color: "rgba(255,255,255,0.7)" },
          { label: "Median", value: bracket.median, color: "rgba(61,214,140,0.7)"  },
          { label: "Mean",   value: bracket.mean,   color: "rgba(255,200,80,0.55)" },
        ].map(row => (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: row.color }}>{row.label}</span>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: row.color }}>
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(row.value)}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: row.color,
                width: `${Math.min(100, (row.value / maxBar) * 100)}%`,
                transition: "width 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({ name, value, color }: { name: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{
        fontSize: 11, color: "rgba(255,255,255,0.3)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        maxWidth: "56%",
      }}>
        {name}
      </span>
      <span style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        color, flexShrink: 0,
      }}>
        {new Intl.NumberFormat("en-US", {
          style: "currency", currency: "USD", maximumFractionDigits: 0,
        }).format(value)}
      </span>
    </div>
  );
}
