"use client";

import { useEffect, useState, useRef } from "react";
import { api, Account, Budget, PointsSummary, Transaction, Insight } from "@/lib/api";
import { fmt, previousMonth, monthLabel, fmtDate } from "@/lib/utils";
import Link from "next/link";
import {
  Landmark,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
  Link2,
  Bell,
  ChevronRight,
  AlertTriangle,
  DollarSign,
  Hash,
  RefreshCw,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GlassCard } from "@/components/GlassCard";

// ── Category maps ─────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Drink":   "🍽",
  "Groceries":      "🛒",
  "Travel":         "✈",
  "Transportation": "🚗",
  "Entertainment":  "🎬",
  "Shopping":       "🛍",
  "Health":         "💊",
  "Utilities":      "⚡",
  "Home":           "🏠",
  "Education":      "📚",
  "Personal Care":  "💆",
  "Business":       "💼",
  "Income":         "💰",
  "Transfers":      "🔄",
};

const CAT_COLOR: Record<string, string> = {
  "Food & Drink":   "#F97316",
  "Groceries":      "#34D399",
  "Travel":         "#38BDF8",
  "Transportation": "#FBBF24",
  "Entertainment":  "#A78BFA",
  "Shopping":       "#F472B6",
  "Health":         "#FB7185",
  "Utilities":      "#9CA3AF",
  "Home":           "#2DD4BF",
  "Education":      "#818CF8",
  "Personal Care":  "#E879F9",
  "Business":       "#22D3EE",
};

const CAT_DOT: Record<string, string> = {
  "Food & Drink":   "bg-orange-400",
  "Groceries":      "bg-emerald-400",
  "Travel":         "bg-sky-400",
  "Transportation": "bg-yellow-400",
  "Entertainment":  "bg-violet-400",
  "Shopping":       "bg-pink-400",
  "Health":         "bg-rose-400",
  "Utilities":      "bg-ink-secondary",
  "Home":           "bg-teal-400",
};

// ── Budget Row ────────────────────────────────────────────────────────────────

function BudgetRow({
  category, actual, budget, pct, index, pctMonthElapsed,
}: {
  category: string; actual: number; budget: number;
  pct: number; index: number; pctMonthElapsed: number;
}) {
  const over = pct > 100;
  const warn = pct > 80 && !over;

  const barColor = over
    ? "linear-gradient(90deg, #F87171, #EF4444)"
    : warn
    ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
    : "linear-gradient(90deg, #34D399, #10B981)";

  const pctColor = over ? "text-semantic-expense" : warn ? "text-semantic-warning" : "text-semantic-income";

  const paceRatio = pctMonthElapsed > 0 ? (pct / 100) / pctMonthElapsed : 0;
  const paceLabel = paceRatio > 1.2 ? `⚠ ${Math.round((paceRatio - 1) * 100)}% over pace` : paceRatio > 0.9 ? "On pace" : "Good";
  const paceBadgeClass = paceRatio > 1.2
    ? "bg-semantic-expense/10 text-semantic-expense border-semantic-expense/20"
    : paceRatio > 0.9
    ? "bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20"
    : "bg-semantic-income/10 text-semantic-income border-semantic-income/20";

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CAT_DOT[category] ?? "bg-ink-tertiary"}`} />
          <span className="text-[13px] text-ink-secondary font-medium truncate">{category}</span>
          {pctMonthElapsed > 0 && (
            <span className={`hidden sm:inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${paceBadgeClass}`}>
              {paceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className={`text-[11px] font-semibold font-mono ${pctColor}`}>{pct.toFixed(0)}%</span>
          <span className="text-[11px] font-mono text-ink-tertiary">
            {fmt(actual)}<span className="mx-1 opacity-30">/</span>{fmt(budget)}
          </span>
        </div>
      </div>
      <AnimatedBar pct={Math.min(pct, 100)} color={barColor} height={3} delay={index * 60} />
    </div>
  );
}

// ── Account Row ───────────────────────────────────────────────────────────────

function AccountRow({
  account: a, isCredit, onDragStart, onDrop,
}: {
  account: Account; isCredit: boolean;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(a.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(a.id)}
    >
      <Link
        href={`/transactions?account_id=${a.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors group"
      >
        <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${
          isCredit
            ? "bg-honey/[0.08] border border-honey/[0.12]"
            : "bg-semantic-income/[0.08] border border-semantic-income/[0.12]"
        }`}>
          {isCredit
            ? <CreditCard className="w-3.5 h-3.5 text-honey/70" strokeWidth={1.8} />
            : <Landmark   className="w-3.5 h-3.5 text-semantic-income/70" strokeWidth={1.8} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-ink-primary font-medium truncate leading-snug">
            {isCredit ? (a.official_name ?? a.name) : a.name}
          </p>
          <p className="text-[10px] font-mono text-ink-tertiary/60 tracking-wide">
            {a.institution || (a.is_manual ? "Manual" : "Bank")}
            {a.mask ? ` · •••• ${a.mask}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[13px] font-mono font-semibold tabular-nums ${isCredit ? "text-honey" : "text-ink-primary"}`}>
            {fmt(a.current_balance ?? 0)}
          </p>
          {isCredit && a.credit_limit ? (
            <p className="text-[10px] font-mono text-ink-tertiary/50">of {fmt(a.credit_limit)}</p>
          ) : (
            <p className="text-[10px] text-ink-tertiary/50 capitalize">{a.subtype ?? a.type}</p>
          )}
        </div>
        <ArrowRight className="w-3 h-3 text-ink-tertiary/20 group-hover:text-ink-tertiary/50 group-hover:translate-x-0.5 transition-all ml-1 shrink-0" />
      </Link>
    </div>
  );
}

// ── Today strip helpers ───────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

interface TodayData {
  spentToday: number; countToday: number;
  spentYesterday: number; lastSyncedAt: string | null;
}

function TodayActivityStrip({ data, loading }: { data: TodayData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="hive-card rounded-xl overflow-hidden">
        <div className="flex divide-x divide-white/[0.05]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 py-3.5 px-4 animate-pulse space-y-1.5">
              <div className="h-1.5 bg-white/[0.06] rounded-full w-10 mx-auto" />
              <div className="h-3.5 bg-white/[0.08] rounded w-14 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const delta = data.spentToday - data.spentYesterday;
  const absDelta = Math.abs(delta);
  const deltaLabel = delta > 0
    ? `+${fmt(absDelta)} vs yesterday`
    : delta < 0 ? `-${fmt(absDelta)} vs yesterday` : "Same as yesterday";
  const deltaColor = delta > 0 ? "text-semantic-expense" : delta < 0 ? "text-semantic-income" : "text-ink-tertiary";

  const tiles: { icon: React.ElementType; label: string; value: string; valueClass?: string }[] = [
    { icon: DollarSign, label: "Spent today",    value: fmt(data.spentToday) },
    { icon: Hash,       label: "Transactions",   value: `${data.countToday}` },
    { icon: data.spentToday >= data.spentYesterday ? TrendingUp : TrendingDown,
                        label: "vs. yesterday",  value: deltaLabel, valueClass: deltaColor },
    { icon: RefreshCw,  label: "Last synced",    value: data.lastSyncedAt ? relativeTime(data.lastSyncedAt) : "—" },
  ];

  return (
    <div className="hive-card rounded-xl overflow-hidden">
      <div className="flex divide-x divide-white/[0.05]">
        {tiles.map(({ icon: Icon, label, value, valueClass }) => (
          <div key={label} className="flex-1 flex flex-col items-center justify-center py-3.5 px-4 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <Icon className="w-2.5 h-2.5 text-ink-tertiary/50 shrink-0" strokeWidth={1.8} />
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-tertiary/60 whitespace-nowrap">
                {label}
              </p>
            </div>
            <p className={`text-[13px] font-semibold font-mono truncate max-w-full text-center ${valueClass ?? "text-ink-primary"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ACCT_ORDER_KEY = "hive_acct_order";
function loadAcctOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(ACCT_ORDER_KEY) ?? "[]"); } catch { return []; }
}
function saveAcctOrder(ids: string[]) { localStorage.setItem(ACCT_ORDER_KEY, JSON.stringify(ids)); }
function applyOrder(accounts: Account[], order: string[]): Account[] {
  if (!order.length) return accounts;
  const map = new Map(accounts.map((a) => [a.id, a]));
  const ordered = order.filter((id) => map.has(id)).map((id) => map.get(id)!);
  return [...ordered, ...accounts.filter((a) => !order.includes(a.id))];
}

export default function Dashboard() {
  const month = previousMonth();
  const currentMonthLabel = monthLabel(month);

  const [accts, setAccts]         = useState<Account[]>([]);
  const [acctOrder, setAcctOrder] = useState<string[]>([]);
  const [bdgts, setBdgts]         = useState<Budget[]>([]);
  const [pts, setPts]             = useState<PointsSummary | null>(null);
  const [recentTx, setRecentTx]   = useState<Transaction[]>([]);
  const [spendData, setSpendData] = useState<{ category: string; spend: number }[]>([]);
  const [insights, setInsights]   = useState<Insight[]>([]);
  const [loading, setLoading]     = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const dragSrc = useRef<string | null>(null);

  useEffect(() => {
    setAcctOrder(loadAcctOrder());
    Promise.allSettled([
      api.accounts.list(),
      api.budgets.list(month),
      api.points.summary(),
      api.transactions.list({ month, page_size: 10, include_pending: false }),
      api.transactions.spendByCategory(month),
      api.insights.list(10),
    ]).then(([accountsRes, budgetsRes, pointsRes, txRes, spendRes, insightsRes]) => {
      if (accountsRes.status === "fulfilled") setAccts(accountsRes.value);
      if (budgetsRes.status  === "fulfilled") setBdgts(budgetsRes.value);
      if (pointsRes.status   === "fulfilled") setPts(pointsRes.value);
      if (txRes.status       === "fulfilled") setRecentTx(txRes.value.items);
      if (spendRes.status    === "fulfilled") setSpendData(spendRes.value);
      if (insightsRes.status === "fulfilled") {
        const { insights: arr } = insightsRes.value;
        setInsights(arr.filter((i) => !i.is_read && !i.is_dismissed).slice(0, 3));
      }
      if (accountsRes.status === "rejected" || budgetsRes.status === "rejected") {
        setCriticalError("Some data failed to load. Check your connection or try refreshing.");
      }
      setLoading(false);
    });
  }, [month]);

  useEffect(() => {
    const today     = toLocalDateStr(new Date());
    const yd        = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterday = toLocalDateStr(yd);

    Promise.allSettled([
      api.transactions.list({ page_size: 50, include_pending: false }),
      fetch("/api/plaid/last-synced", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([txRes, syncRes]) => {
      const items = txRes.status === "fulfilled" ? txRes.value.items : [];
      const todayTxs     = items.filter((tx) => tx.date === today     && !tx.is_excluded);
      const yesterdayTxs = items.filter((tx) => tx.date === yesterday && !tx.is_excluded);
      const lastSyncedAt = syncRes.status === "fulfilled" && syncRes.value?.last_synced_at
        ? (syncRes.value as { last_synced_at: string }).last_synced_at
        : null;
      setTodayData({
        spentToday:     todayTxs.reduce((s, tx) => s + tx.amount, 0),
        countToday:     todayTxs.length,
        spentYesterday: yesterdayTxs.reduce((s, tx) => s + tx.amount, 0),
        lastSyncedAt,
      });
    })
    .catch(() => setTodayData(null))
    .finally(() => setTodayLoading(false));
  }, []);

  const sortedAccts = applyOrder(accts, acctOrder);
  const creditCards = sortedAccts.filter((a) => a.type === "credit");
  const bankAccts   = sortedAccts.filter((a) => a.type !== "credit");
  const totalAssets = bankAccts.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const totalDebt   = creditCards.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const netCash     = totalAssets - totalDebt;
  const pointsValue = pts?.total_estimated_value_dollars ?? 0;
  const alerts      = pts?.programs.filter((p) => p.above_threshold) ?? [];
  const noAccounts  = !loading && accts.length === 0;

  function handleDragStart(id: string) { dragSrc.current = id; }
  function handleDrop(targetId: string) {
    if (!dragSrc.current || dragSrc.current === targetId) return;
    const ids = sortedAccts.map((a) => a.id);
    const from = ids.indexOf(dragSrc.current);
    const to   = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1); ids.splice(to, 0, dragSrc.current);
    dragSrc.current = null;
    setAcctOrder(ids); saveAcctOrder(ids);
  }

  const spendItems = spendData.filter((d) => d.category !== "Transfers" && d.category !== "Uncategorized").slice(0, 6);
  const maxSpend   = Math.max(...spendItems.map((b) => b.spend), 1);

  const pctMonthElapsed = (() => {
    const now = new Date();
    return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  })();

  function insightIcon(type: string): string {
    if (type.includes("anomal") || type.includes("warn") || type.includes("spike")) return "⚠️";
    if (type.includes("tip") || type.includes("saving") || type.includes("suggest")) return "💡";
    return "🔔";
  }

  function handleInsightClick(insight: Insight) {
    if (!insight.is_read) {
      api.insights.markRead(insight.id).catch(() => {});
      setInsights((prev) => prev.filter((i) => i.id !== insight.id));
    }
  }

  function handleMarkAllRead() {
    api.insights.markAllRead().catch(() => {});
    setInsights([]);
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Critical error ───────────────────────────────────────────── */}
      {criticalError && (
        <div className="glass-card-expense flex items-center gap-3 p-4 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-semantic-expense flex-shrink-0" />
          <p className="text-[13px] text-semantic-expense">{criticalError}</p>
          <button onClick={() => window.location.reload()} className="ml-auto hive-btn-ghost text-[12px]">Retry</button>
        </div>
      )}

      {/* ── Action bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2">
        {alerts.length > 0 && (
          <Link href="/points"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-honey/[0.08] border border-honey/20
                       text-[12px] font-semibold text-honey hover:bg-honey/[0.14] transition-all duration-150">
            <Bell className="w-3 h-3" />
            {alerts.length} reward{alerts.length > 1 ? "s" : ""} ready
          </Link>
        )}
        <Link href="/connect"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-white/[0.07]
                     text-[12px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-white/[0.06]
                     transition-all duration-150">
          <Link2 className="w-3 h-3" />
          {noAccounts ? "Connect account" : "Add account"}
        </Link>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PageHero
        eyebrow={`Dashboard · ${currentMonthLabel}`}
        headline={<span className="text-honey">{fmt(netCash)}</span>}
        subtext="net cash position this month"
        glowColor="honey"
        statStrip={[
          { label: "Total Assets",  value: fmt(totalAssets),              color: "green"   },
          { label: "Credit Used",   value: fmt(totalDebt),                color: "red"     },
          { label: "Points Value",  value: pts ? fmt(pointsValue) : "—", color: "amber"   },
          { label: currentMonthLabel, value: `${bdgts.length} budget${bdgts.length !== 1 ? "s" : ""}`, color: "default" },
        ]}
      />

      {/* ── Today strip ──────────────────────────────────────────────── */}
      {!noAccounts && <TodayActivityStrip data={todayData} loading={todayLoading} />}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {noAccounts && (
        <div className="flex flex-col items-center justify-center min-h-[55vh] animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-honey/[0.10] border border-honey/20 flex items-center justify-center mb-5">
            <svg viewBox="0 0 40 46" className="w-8 h-8 fill-honey opacity-80" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0L40 11.5V34.5L20 46L0 34.5V11.5L20 0Z"/>
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold text-ink-primary mb-1.5">Welcome to Hive</h2>
          <p className="text-[13px] text-ink-secondary text-center max-w-xs mb-7 leading-relaxed">
            Connect your accounts to see your complete financial picture in one place.
          </p>
          <a href="/connect" className="hive-btn-primary px-6 py-2.5 text-[13px] mb-8">Connect Accounts</a>
          <div className="grid grid-cols-3 gap-3 max-w-xl w-full">
            {[
              { icon: "💳", title: "Track Spending",    desc: "Every transaction, auto-categorized" },
              { icon: "⭐", title: "Optimize Rewards",  desc: "Always use the right card" },
              { icon: "🤖", title: "Ask AI",            desc: "Chat with your finances" },
            ].map((f) => (
              <div key={f.title} className="hive-card p-4 text-center">
                <div className="text-xl mb-2">{f.icon}</div>
                <p className="text-[12px] font-semibold text-ink-primary mb-1">{f.title}</p>
                <p className="text-[11px] text-ink-tertiary leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Insights ──────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="hive-card overflow-hidden">
          <div className="hive-section-header">
            <div className="flex items-center gap-2">
              <h2 className="hive-label">AI Insights</h2>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-honey/[0.12] text-honey border border-honey/20">
                {insights.length}
              </span>
            </div>
            <button onClick={handleMarkAllRead} className="text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
              Mark all read
            </button>
          </div>
          <div className="flex gap-3 px-4 pb-4 overflow-x-auto scrollbar-hide">
            {insights.map((insight) => (
              <button key={insight.id} onClick={() => handleInsightClick(insight)}
                className="flex-shrink-0 w-60 text-left rounded-xl p-4 border border-white/[0.06]
                           bg-gradient-to-br from-honey/[0.04] via-transparent to-transparent
                           hover:border-honey/20 hover:from-honey/[0.08] transition-all duration-200 group">
                <div className="flex items-start gap-3">
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{insightIcon(insight.insight_type)}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-ink-primary leading-snug mb-1 group-hover:text-honey transition-colors">
                      {insight.title}
                    </p>
                    <p className="text-[11px] text-ink-tertiary leading-relaxed line-clamp-3">{insight.body}</p>
                    {insight.amount !== null && (
                      <p className="mt-2 text-[11px] font-mono font-semibold text-semantic-expense">{fmt(insight.amount)}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Spending Breakdown ───────────────────────────────────────── */}
      {!noAccounts && spendItems.length > 0 && (
        <div className="hive-card overflow-hidden">
          <div className="hive-section-header">
            <h2 className="hive-label">Spending · {currentMonthLabel}</h2>
            <Link href="/reports" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
              Reports <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {spendItems.map((item, i) => (
              <div key={item.category} className="flex items-center gap-3" style={{ animationDelay: `${i * 50}ms` }}>
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CAT_COLOR[item.category] ?? "#4B5063" }}
                />
                <span className="text-[12px] text-ink-secondary w-[112px] shrink-0 truncate">{item.category}</span>
                <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full animate-bar-grow"
                    style={{
                      "--bar-w": `${(item.spend / maxSpend) * 100}%`,
                      background: CAT_COLOR[item.category] ?? "rgba(255,255,255,0.15)",
                      opacity: 0.7,
                    } as React.CSSProperties}
                  />
                </div>
                <span className="text-[12px] font-mono text-ink-tertiary tabular-nums w-16 text-right shrink-0">
                  {fmt(item.spend)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Accounts loading skeleton ────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="hive-card overflow-hidden">
              <div className="hive-section-header animate-pulse">
                <div className="h-2.5 bg-white/[0.06] rounded w-16" />
                <div className="h-4 bg-white/[0.08] rounded w-20" />
              </div>
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-8 h-8 rounded-[10px] bg-white/[0.06] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-white/[0.08] rounded w-32" />
                    <div className="h-1.5 bg-white/[0.04] rounded w-20" />
                  </div>
                  <div className="h-3.5 bg-white/[0.06] rounded w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Assets + Liabilities ─────────────────────────────────────── */}
      {!noAccounts && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Assets */}
          <div className="hive-card overflow-hidden">
            <div className="hive-section-header">
              <div>
                <h2 className="hive-label">Assets</h2>
                <p className="text-[11px] text-ink-tertiary mt-0.5">{bankAccts.length} account{bankAccts.length !== 1 ? "s" : ""}</p>
              </div>
              <span className="text-[15px] font-semibold font-mono text-semantic-income tabular-nums">{fmt(totalAssets)}</span>
            </div>
            {bankAccts.length === 0 ? (
              <p className="px-5 py-8 text-[12px] text-ink-tertiary text-center">No bank accounts linked</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {bankAccts.map((a) => (
                  <AccountRow key={a.id} account={a} isCredit={false} onDragStart={handleDragStart} onDrop={handleDrop} />
                ))}
              </div>
            )}
          </div>

          {/* Liabilities */}
          <div className="hive-card overflow-hidden">
            <div className="hive-section-header">
              <div>
                <h2 className="hive-label">Liabilities</h2>
                <p className="text-[11px] text-ink-tertiary mt-0.5">{creditCards.length} card{creditCards.length !== 1 ? "s" : ""}</p>
              </div>
              <span className="text-[15px] font-semibold font-mono text-semantic-expense tabular-nums">{fmt(totalDebt)}</span>
            </div>
            {creditCards.length === 0 ? (
              <p className="px-5 py-8 text-[12px] text-ink-tertiary text-center">No credit cards linked</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {creditCards.map((a) => (
                  <AccountRow key={a.id} account={a} isCredit={true} onDragStart={handleDragStart} onDrop={handleDrop} />
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Recent Transactions ──────────────────────────────────────── */}
      {!noAccounts && (
        <div className="hive-card overflow-hidden">
          <div className="hive-section-header">
            <h2 className="hive-label">Recent Transactions</h2>
            <Link href="/transactions" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-[10px] bg-white/[0.06] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-white/[0.08] rounded w-36" />
                    <div className="h-1.5 bg-white/[0.04] rounded w-16" />
                  </div>
                  <div className="h-3.5 bg-white/[0.06] rounded w-14" />
                </div>
              ))
            ) : recentTx.length === 0 ? (
              <p className="px-5 py-10 text-[12px] text-ink-tertiary text-center">
                No transactions for {monthLabel(month)}
              </p>
            ) : (
              recentTx.map((tx) => (
                <Link key={tx.id} href={`/transactions?account_id=${tx.account_id}`}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors group">
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 bg-elevated border border-white/[0.06] overflow-hidden">
                    {tx.logo_url
                      ? <img src={tx.logo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[14px] leading-none">{CATEGORY_EMOJI[tx.category ?? ""] ?? "💳"}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink-primary font-medium truncate leading-snug">
                      {tx.merchant ?? tx.raw_description}
                    </p>
                    <p className="text-[10px] text-ink-tertiary/60 font-mono">{fmtDate(tx.date)}</p>
                  </div>
                  <p className={`text-[13px] font-mono font-medium shrink-0 tabular-nums ${tx.amount < 0 ? "text-semantic-income" : "text-ink-primary"}`}>
                    {tx.amount < 0 ? "+" : ""}{fmt(Math.abs(tx.amount))}
                  </p>
                </Link>
              ))
            )}
          </div>
          {!loading && recentTx.length > 0 && (
            <div className="px-4 py-3 hive-divider">
              <Link href="/transactions" className="hive-btn-secondary w-full text-[12px] py-2">
                View all transactions <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Budgets ──────────────────────────────────────────────────── */}
      <div className="hive-card overflow-hidden">
        <div className="hive-section-header">
          <h2 className="hive-label">Budgets</h2>
          <Link href="/budgets" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
            Manage <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {bdgts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[13px] text-ink-secondary mb-1">No budgets set</p>
            <p className="text-[12px] text-ink-tertiary mb-4">Set monthly spending limits to track your progress.</p>
            <Link href="/budgets" className="text-[12px] text-honey/80 hover:text-honey transition-colors">Create budgets →</Link>
          </div>
        ) : (
          <div className="px-5 divide-y divide-white/[0.04]">
            {bdgts.map((b, i) => (
              <BudgetRow key={b.id} category={b.category} actual={b.actual_spend}
                budget={b.budget_amount} pct={b.pct_used} index={i} pctMonthElapsed={pctMonthElapsed} />
            ))}
          </div>
        )}
      </div>

      {/* ── Points Programs ──────────────────────────────────────────── */}
      <div className="hive-card overflow-hidden">
        <div className="hive-section-header">
          <h2 className="hive-label">Points Programs</h2>
          <Link href="/points" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
            Details <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {!pts || pts.programs.length === 0 ? (
          <p className="px-5 py-8 text-[12px] text-ink-tertiary text-center">No points data available</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {pts.programs.map((p) => (
              <div key={p.program} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] text-ink-primary font-medium">{p.program}</p>
                    {p.above_threshold && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-honey/[0.12] text-honey border border-honey/20">
                        REDEEM
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-tertiary font-mono mt-0.5">
                    {Math.round(p.points_earned_90d).toLocaleString()} pts · 90-day
                  </p>
                </div>
                <p className="text-[13px] font-mono font-semibold text-semantic-income tabular-nums shrink-0">
                  ≈ {fmt(p.estimated_value_dollars)}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 py-3 hive-divider">
          <Link href="/optimize" className="hive-btn-primary w-full text-[12px] py-2.5">
            <Zap className="w-3.5 h-3.5" />
            Card optimizer
          </Link>
        </div>
      </div>

    </div>
  );
}
