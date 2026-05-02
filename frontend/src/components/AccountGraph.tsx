"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, Account, NetWorthSnapshot, SpendByCategory, Transaction } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ArrowLeft, Search, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

// ── Colors ──────────────────────────────────────────────────────────────────

const CREDIT_COLORS = [
  "#7C6AFA", "#FB923C", "#F472B6", "#FBBF24", "#C084FC", "#F97066", "#A3E635", "#60A5FA",
];
const CAT_COLORS = [
  "#7C6AFA", "#38BDF8", "#FB923C", "#F472B6",
  "#A3E635", "#34D399", "#60A5FA", "#C084FC",
  "#F97066", "#FBBF24",
];
const INCOME_COLOR = "#32D583";
const DEPOSIT_COLOR = "#38BDF8";
const INVEST_COLOR  = "#34D399";

function acctColor(a: Account, creditIdx: number): string {
  const t = a.type.toLowerCase();
  if (t === "credit") return CREDIT_COLORS[creditIdx % CREDIT_COLORS.length];
  if (t === "investment" || a.subtype === "brokerage") return INVEST_COLOR;
  return DEPOSIT_COLOR;
}

function nodeR(balance: number, maxBalance: number): number {
  if (maxBalance === 0) return 16;
  return Math.max(12, Math.min(36, Math.sqrt(Math.abs(balance) / maxBalance) * 36));
}

function abbrev(name: string): string {
  const w = name.trim().split(/\s+/);
  if (w.length === 1) return name.slice(0, 4).toUpperCase();
  return w.slice(0, 2).map((s) => s[0].toUpperCase()).join("");
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[m - 1]} ${y}`;
}

function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, "0")}` };
}

// ── Types ────────────────────────────────────────────────────────────────────

type GraphView =
  | { kind: "graph" }
  | { kind: "account"; account: Account; month: string }
  | { kind: "transactions"; account: Account; category: string; month: string };

interface Positioned {
  account: Account;
  x: number;
  y: number;
  r: number;
  color: string;
}

// ── SVG layout constants ─────────────────────────────────────────────────────

const SVG_W   = 800;
const INC_X   = 52;   // income node center x
const INC_R   = 32;   // income node radius (fixed)
const AST_X   = 210;  // asset column center x
const DIV_X   = 390;  // divider x
const LIA_X   = 560;  // liability column center x
const ROW_H   = 72;   // vertical spacing between account nodes

// ── Component ────────────────────────────────────────────────────────────────

export function AccountGraph() {
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [netWorth, setNetWorth]   = useState<NetWorthSnapshot | null>(null);
  const [income, setIncome]       = useState<number>(0);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<GraphView>({ kind: "graph" });

  const [cats, setCats]           = useState<SpendByCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  const [txns, setTxns]           = useState<Transaction[]>([]);
  const [txTotal, setTxTotal]     = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch]       = useState("");

  // ── Initial data load ────────────────────────────────────────────────────

  useEffect(() => {
    Promise.allSettled([
      api.accounts.list(),
      api.netWorth.history(7),
      api.cashFlow.summary(),
    ]).then(([aRes, nwRes, cfRes]) => {
      if (aRes.status  === "fulfilled") setAccounts(aRes.value.filter((a) => a.is_active && !a.is_excluded));
      if (nwRes.status === "fulfilled" && nwRes.value.length > 0) setNetWorth(nwRes.value[nwRes.value.length - 1]);
      if (cfRes.status === "fulfilled") setIncome(cfRes.value.income);
      setLoading(false);
    });
  }, []);

  // ── Drill-down handlers ──────────────────────────────────────────────────

  const openAccount = useCallback(async (account: Account, month: string) => {
    setView({ kind: "account", account, month });
    setCatLoading(true);
    const { start, end } = monthBounds(month);
    try {
      const data = await api.reports.spendingByCategory(start, end, account.id);
      setCats(data);
    } catch {
      setCats([]);
    } finally {
      setCatLoading(false);
    }
  }, []);

  const openCategory = useCallback(async (account: Account, category: string, month: string) => {
    setView({ kind: "transactions", account, category, month });
    setTxLoading(true);
    setSearch("");
    try {
      const res = await api.transactions.list({ account_id: account.id, category, month, page: 1, page_size: 50 });
      setTxns(res.items);
      setTxTotal(res.total);
    } catch {
      setTxns([]);
      setTxTotal(0);
    } finally {
      setTxLoading(false);
    }
  }, []);

  const changeMonth = useCallback(async (delta: number) => {
    if (view.kind !== "account") return;
    const newMonth = shiftMonth(view.month, delta);
    await openAccount(view.account, newMonth);
  }, [view, openAccount]);

  // ── Layout computation ───────────────────────────────────────────────────

  const { assets, liabilities, creditColorMap } = useMemo(() => {
    const assets: Account[]      = accounts.filter((a) => a.type !== "credit");
    const liabilities: Account[] = accounts.filter((a) => a.type === "credit");
    const creditColorMap = new Map<string, string>();
    liabilities.forEach((a, i) => creditColorMap.set(a.id, CREDIT_COLORS[i % CREDIT_COLORS.length]));
    return { assets, liabilities, creditColorMap };
  }, [accounts]);

  const maxBalance = useMemo(() => {
    const all = [...assets, ...liabilities].map((a) => Math.abs(a.current_balance ?? 0));
    return Math.max(...all, 1);
  }, [assets, liabilities]);

  // Dynamic SVG height — grows to fit whichever column is taller
  const svgH = Math.max(300, Math.max(assets.length, liabilities.length, 1) * ROW_H + 80);
  const incY = svgH / 2;

  // Position nodes vertically centered in their column
  const positioned = useMemo<Positioned[]>(() => {
    const astNodes: Positioned[] = assets.map((a, i) => {
      const r = nodeR(a.current_balance ?? 0, maxBalance);
      const totalH = assets.length * ROW_H;
      const startY  = svgH / 2 - totalH / 2 + ROW_H / 2;
      return { account: a, x: AST_X, y: startY + i * ROW_H, r, color: acctColor(a, 0) };
    });

    const liaNodes: Positioned[] = liabilities.map((a, i) => {
      const r = nodeR(a.current_balance ?? 0, maxBalance);
      const totalH = liabilities.length * ROW_H;
      const startY  = svgH / 2 - totalH / 2 + ROW_H / 2;
      return {
        account: a,
        x: LIA_X,
        y: startY + i * ROW_H,
        r,
        color: creditColorMap.get(a.id) ?? CREDIT_COLORS[0],
      };
    });

    return [...astNodes, ...liaNodes];
  }, [assets, liabilities, maxBalance, creditColorMap, svgH]);

  // ── Graph edges ──────────────────────────────────────────────────────────

  const edges = useMemo(() => {
    const result: { x1: number; y1: number; x2: number; y2: number; color: string; opacity: number }[] = [];
    const checking = positioned.find((p) => p.account.subtype === "checking" || p.account.name.toLowerCase().includes("checking"));
    const savings   = positioned.find((p) => p.account.subtype === "savings"  || p.account.name.toLowerCase().includes("saving"));

    // Income → first asset (checking, or just first asset)
    const firstAsset = checking ?? positioned.find((p) => p.account.type !== "credit");
    if (firstAsset) {
      result.push({ x1: INC_X + INC_R, y1: incY, x2: firstAsset.x - firstAsset.r, y2: firstAsset.y, color: INCOME_COLOR, opacity: 0.4 });
    }

    // Checking → Savings
    if (checking && savings) {
      result.push({ x1: checking.x + checking.r * 0.7, y1: checking.y + checking.r * 0.7, x2: savings.x - savings.r * 0.7, y2: savings.y - savings.r * 0.7, color: DEPOSIT_COLOR, opacity: 0.25 });
    }

    // Checking → each credit card
    if (checking) {
      positioned.filter((p) => p.account.type === "credit").forEach((lia) => {
        result.push({ x1: checking.x + checking.r, y1: checking.y, x2: lia.x - lia.r, y2: lia.y, color: "#F97066", opacity: 0.18 });
      });
    }

    return result;
  }, [positioned]);

  // ── Category node layout (State 2) ──────────────────────────────────────

  const catMaxAmt = useMemo(() => Math.max(...cats.map((c) => c.total), 1), [cats]);

  const catPositions = useMemo(() => {
    const CENTER_X = 300;
    const CENTER_Y = svgH / 2;
    const CAT_X    = 490;
    const CAT_ROW_H = 54;
    const startY   = CENTER_Y - (cats.length * CAT_ROW_H) / 2 + CAT_ROW_H / 2;
    return cats.map((cat, i) => {
      const r = Math.max(14, Math.min(34, Math.sqrt(cat.total / catMaxAmt) * 34));
      return { cat, x: CAT_X, y: startY + i * CAT_ROW_H, r, color: CAT_COLORS[i % CAT_COLORS.length] };
    });
  }, [cats, catMaxAmt, svgH]);

  // ── Rendering ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <GlassCard className="p-5">
        <div className="flex items-center justify-center gap-2 h-48 text-ink-tertiary text-[13px]">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading accounts…</span>
        </div>
      </GlassCard>
    );
  }

  if (accounts.length === 0) {
    return (
      <GlassCard className="p-5">
        <div className="flex flex-col items-center justify-center gap-3 h-48 text-center">
          <p className="text-[13px] font-medium text-ink-primary">No accounts connected</p>
          <p className="text-[11px] text-ink-tertiary">Connect your bank accounts to see your financial graph</p>
          <a href="/connect" className="hive-btn-primary px-4 py-2 text-[12px] mt-1">Connect account</a>
        </div>
      </GlassCard>
    );
  }

  const isAccountView     = view.kind === "account";
  const isTransactionView = view.kind === "transactions";

  const focusedAccount = isAccountView
    ? view.account
    : isTransactionView ? view.account : null;

  void income; // suppress unused warning — income drives edge weight in future
  void focusedAccount; // used for future focused-node highlight

  return (
    <div className="space-y-3">
      <GlassCard className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {view.kind === "graph" && (
              <>
                <p className="text-[13px] font-medium text-ink-primary">Accounts</p>
                {netWorth && (
                  <p className="text-[11px] text-ink-tertiary mt-0.5">
                    Net Worth&nbsp;
                    <span className="text-[11px] font-semibold text-semantic-income">{fmt(netWorth.net_worth)}</span>
                    &nbsp;·&nbsp;
                    <span className="text-[11px] text-semantic-income">Assets {fmt(netWorth.total_assets)}</span>
                    &nbsp;·&nbsp;
                    <span className="text-[11px] text-semantic-expense">Liabilities {fmt(netWorth.total_liabilities)}</span>
                  </p>
                )}
              </>
            )}
            {view.kind === "account" && (
              <>
                <p className="text-[13px] font-medium text-ink-primary">{view.account.name}</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">Spend by category · {monthLabel(view.month)}</p>
              </>
            )}
            {view.kind === "transactions" && (
              <>
                <p className="text-[13px] font-medium text-ink-primary">{view.account.name} · {view.category}</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">{txTotal} transactions · {monthLabel(view.month)}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAccountView && (
              <div className="flex items-center gap-1">
                <button onClick={() => changeMonth(-1)} className="p-1 rounded hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] text-ink-secondary w-16 text-center">{monthLabel(view.month)}</span>
                <button
                  onClick={() => changeMonth(1)}
                  disabled={view.month >= currentMonth()}
                  className="p-1 rounded hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            {view.kind !== "graph" && (
              <button
                onClick={() => {
                  if (view.kind === "transactions") {
                    setView({ kind: "account", account: view.account, month: view.month });
                  } else {
                    setView({ kind: "graph" });
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-ink-tertiary hover:text-ink-primary transition-colors"
              >
                <ArrowLeft size={12} />
                {view.kind === "transactions" ? "Categories" : "All accounts"}
              </button>
            )}
          </div>
        </div>

        {/* SVG Graph */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${SVG_W} ${svgH}`}
            width="100%"
            style={{ minWidth: 480, cursor: "default" }}
            onClick={(e) => {
              if ((e.target as SVGElement).tagName !== "svg") return;
              if (view.kind === "account") setView({ kind: "graph" });
              else if (view.kind === "transactions") setView({ kind: "account", account: view.account, month: view.month });
            }}
          >
            <defs>
              {positioned.map((p) => (
                <radialGradient key={`glow-${p.account.id}`} id={`glow-${p.account.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={p.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={p.color} stopOpacity={0} />
                </radialGradient>
              ))}
              <radialGradient id="glow-income" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.3} />
                <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* ── State 1: full graph ── */}
            {view.kind === "graph" && (
              <>
                {/* Divider line */}
                <line x1={DIV_X} y1={20} x2={DIV_X} y2={svgH - 20} stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="4 4" />

                {/* Column labels */}
                <text x={AST_X} y={14} textAnchor="middle" fill="#6B6B73" fontSize={9} fontWeight={600} letterSpacing={1}>ASSETS</text>
                <text x={LIA_X} y={14} textAnchor="middle" fill="#6B6B73" fontSize={9} fontWeight={600} letterSpacing={1}>LIABILITIES</text>

                {/* Edges */}
                {edges.map((e, i) => (
                  <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} strokeWidth={1.2} opacity={e.opacity} />
                ))}

                {/* Income node */}
                <g
                  style={{ cursor: "pointer" }}
                  onClick={(ev) => { ev.stopPropagation(); openAccount(assets[0] ?? accounts[0], currentMonth()); }}
                >
                  <circle cx={INC_X} cy={incY} r={INC_R + 14} fill="url(#glow-income)" />
                  <circle cx={INC_X} cy={incY} r={INC_R} fill="#111820" stroke={INCOME_COLOR} strokeWidth={1.5} />
                  <text x={INC_X} y={incY - 6} textAnchor="middle" fill={INCOME_COLOR} fontSize={16} fontWeight={700}>$</text>
                  <text x={INC_X} y={incY + 9} textAnchor="middle" fill="#6B6B73" fontSize={7.5}>Income</text>
                </g>

                {/* Account nodes */}
                {positioned.map((p) => (
                  <g
                    key={p.account.id}
                    style={{ cursor: "pointer", transition: "opacity 150ms" }}
                    onClick={(ev) => { ev.stopPropagation(); openAccount(p.account, currentMonth()); }}
                  >
                    {/* Glow halo */}
                    <circle cx={p.x} cy={p.y} r={p.r + 14} fill={`url(#glow-${p.account.id})`} />
                    {/* Node circle */}
                    <circle cx={p.x} cy={p.y} r={p.r} fill="#111118" stroke={p.color} strokeWidth={1.5} />
                    {/* Abbreviation */}
                    <text x={p.x} y={p.y - 3} textAnchor="middle" fill={p.color} fontSize={Math.max(7, p.r * 0.38)} fontWeight={600}>{abbrev(p.account.name)}</text>
                    {/* Balance */}
                    <text x={p.x} y={p.y + 10} textAnchor="middle" fill="#F5F5F7" fontSize={7.5} fontWeight={700}>
                      {fmt(Math.abs(p.account.current_balance ?? 0))}
                    </text>
                  </g>
                ))}
              </>
            )}

            {/* ── State 2: account detail (categories) ── */}
            {view.kind === "account" && (
              <>
                {/* Faint account node (centered left) */}
                {(() => {
                  const p = positioned.find((n) => n.account.id === view.account.id);
                  if (!p) return null;
                  const cx = 200, cy = svgH / 2;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={36} fill="#111118" stroke={positioned.find((n) => n.account.id === view.account.id)?.color ?? DEPOSIT_COLOR} strokeWidth={2} />
                      <text x={cx} y={cy - 5} textAnchor="middle" fill={positioned.find((n) => n.account.id === view.account.id)?.color ?? DEPOSIT_COLOR} fontSize={10} fontWeight={600}>{abbrev(view.account.name)}</text>
                      <text x={cx} y={cy + 10} textAnchor="middle" fill="#F5F5F7" fontSize={8} fontWeight={700}>{fmt(Math.abs(view.account.current_balance ?? 0))}</text>
                    </g>
                  );
                })()}

                {catLoading && (
                  <text x={SVG_W / 2} y={svgH / 2} textAnchor="middle" fill="#6B6B73" fontSize={12}>Loading…</text>
                )}

                {!catLoading && cats.length === 0 && (
                  <text x={SVG_W / 2} y={svgH / 2} textAnchor="middle" fill="#6B6B73" fontSize={12}>No spend this month</text>
                )}

                {/* Category nodes + wires */}
                {!catLoading && catPositions.map((cp) => (
                  <g key={cp.cat.category} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); openCategory(view.account, cp.cat.category, view.month); }}>
                    {/* Wire from account node to category */}
                    <line x1={200 + 36} y1={svgH / 2} x2={cp.x - cp.r} y2={cp.y} stroke={cp.color} strokeWidth={Math.max(1, Math.round((cp.cat.total / catMaxAmt) * 8))} opacity={0.4} />
                    {/* Glow */}
                    <circle cx={cp.x} cy={cp.y} r={cp.r + 10} fill={cp.color} opacity={0.08} />
                    {/* Node */}
                    <circle cx={cp.x} cy={cp.y} r={cp.r} fill="#111118" stroke={cp.color} strokeWidth={1.5} />
                    <text x={cp.x} y={cp.y - 4} textAnchor="middle" fill={cp.color} fontSize={7.5} fontWeight={600}>{cp.cat.category.split(" ")[0]}</text>
                    <text x={cp.x} y={cp.y + 8} textAnchor="middle" fill="#F5F5F7" fontSize={8} fontWeight={700}>{fmt(cp.cat.total)}</text>
                  </g>
                ))}
              </>
            )}

            {/* ── State 3: transaction view (graph just shows account + selected category) ── */}
            {view.kind === "transactions" && (
              <>
                <circle cx={200} cy={svgH / 2} r={28} fill="#111118" stroke={positioned.find((n) => n.account.id === view.account.id)?.color ?? DEPOSIT_COLOR} strokeWidth={2} />
                <text x={200} y={svgH / 2 - 4} textAnchor="middle" fill={positioned.find((n) => n.account.id === view.account.id)?.color ?? DEPOSIT_COLOR} fontSize={9} fontWeight={600}>{abbrev(view.account.name)}</text>
                <text x={200} y={svgH / 2 + 8} textAnchor="middle" fill="#F5F5F7" fontSize={7}>
                  {view.category}
                </text>
                <text x={SVG_W / 2} y={svgH / 2} textAnchor="middle" fill="#6B6B73" fontSize={11}>
                  {txLoading ? "Loading transactions…" : `${txTotal} transactions`}
                </text>
              </>
            )}
          </svg>
        </div>
      </GlassCard>

      {/* ── Transaction panel (State 3) ── */}
      {view.kind === "transactions" && (
        <GlassCard className="overflow-hidden">
          {/* Filter bar */}
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="text"
                placeholder="Search transactions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-white/[0.15]"
              />
            </div>
            <span className="text-[11px] text-ink-tertiary">
              {monthLabel(view.month)}
            </span>
          </div>

          {/* Transaction list */}
          <div className="divide-y divide-white/[0.03]">
            {txLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-ink-tertiary text-[12px]">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading…</span>
              </div>
            ) : txns.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-ink-tertiary">No transactions found.</div>
            ) : (
              txns
                .filter((t) =>
                  !search ||
                  (t.merchant ?? t.raw_description).toLowerCase().includes(search.toLowerCase())
                )
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-[16px]">
                      {t.category === "Travel" ? "✈" : t.category === "Food & Drink" ? "🍽" : t.category === "Groceries" ? "🛒" : "💳"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-ink-primary truncate">{t.merchant ?? t.raw_description}</p>
                      <p className="text-[10px] text-ink-tertiary">{t.date}{t.subcategory ? ` · ${t.subcategory}` : ""}</p>
                    </div>
                    <p className="text-[12px] font-semibold font-mono text-semantic-expense tabular-nums shrink-0">
                      -{fmt(t.amount)}
                    </p>
                  </div>
                ))
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
