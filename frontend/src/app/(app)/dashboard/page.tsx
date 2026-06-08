"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Account, Anomaly, Budget, Goal, HealthScore, Insight, MerchantSummary, MonthlyPosition, PaceAlert, PointsSummary, SafeToSpend, Transaction, WeeklyComparison } from "@/lib/api";
import { fmt, currentMonth, monthLabel, cn } from "@/lib/utils";
import Link from "next/link";
import {
  Zap,
  Link2,
  Bell,
  ChevronRight,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Info,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";

// ── Category maps ─────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  "Food & Drink":   "#c2663a",
  "Groceries":      "#2d9e72",
  "Travel":         "#2e8fb5",
  "Transportation": "#b89a2a",
  "Entertainment":  "#7c6ab8",
  "Shopping":       "#a8527a",
  "Health":         "#b84f6a",
  "Utilities":      "#6b7285",
  "Home":           "#2a9090",
  "Education":      "#5a67b8",
  "Personal Care":  "#a050b0",
  "Business":       "#2a8aa0",
};

const CAT_DOT: Record<string, string> = {
  "Food & Drink":   "#c2663a",
  "Groceries":      "#2d9e72",
  "Travel":         "#2e8fb5",
  "Transportation": "#b89a2a",
  "Entertainment":  "#7c6ab8",
  "Shopping":       "#a8527a",
  "Health":         "#b84f6a",
  "Utilities":      "#6b7285",
  "Home":           "#2a9090",
};

// ── Safe to Spend card ────────────────────────────────────────────────────────

const STS_BG: Record<string, string> = {
  green: "rgba(34,197,94,0.08)",
  amber: "rgba(245,185,66,0.08)",
  red:   "rgba(239,68,68,0.08)",
};
const STS_BORDER: Record<string, string> = {
  green: "rgba(34,197,94,0.20)",
  amber: "rgba(245,185,66,0.20)",
  red:   "rgba(239,68,68,0.20)",
};
const STS_COLOR: Record<string, string> = {
  green: "var(--color-income, #2d9e72)",
  amber: "var(--color-honey, #3B82F6)",
  red:   "var(--color-expense, #ef4444)",
};

function SafeToSpendCard({ data }: { data: SafeToSpend }) {
  const [expanded, setExpanded] = useState(false);
  const color = data.color;
  const isNegative = data.safe_to_spend < 0;
  const dailyAllowance = !isNegative && data.days_remaining > 0
    ? data.safe_to_spend / data.days_remaining
    : null;
  // Spending pace: what % of income is already gone (spent + committed)
  const committed = data.breakdown.spent_this_month + data.breakdown.upcoming_bills + data.breakdown.goal_savings;
  const spendPct = data.breakdown.monthly_income > 0
    ? Math.min(100, Math.round((committed / data.breakdown.monthly_income) * 100))
    : 0;

  return (
    <div
      className="mx-6 rounded-xl px-[18px] py-[14px] cursor-pointer select-none"
      style={{ border: `1px solid ${STS_BORDER[color]}`, background: STS_BG[color] }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: STS_COLOR[color] }}>
            Safe to spend
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[28px] font-bold font-mono leading-none" style={{ color: STS_COLOR[color] }}>
              {isNegative ? "-" : ""}{fmt(Math.abs(data.safe_to_spend))}
            </span>
            {dailyAllowance !== null && (
              <span className="text-[13px] font-mono font-semibold text-ink-secondary">
                {fmt(dailyAllowance)}<span className="text-[11px] font-normal text-ink-tertiary">/day</span>
              </span>
            )}
            <span className="text-[12px] text-ink-tertiary">
              · {data.days_remaining}d left
            </span>
          </div>
          {!expanded && (
            <p className="text-[11px] text-ink-tertiary mt-1">
              <span className="font-mono">{fmt(data.breakdown.spent_this_month)}</span> spent · <span className="font-mono">{fmt(data.breakdown.upcoming_bills)}</span> upcoming · <span className="font-mono">{spendPct}%</span> of income committed
            </p>
          )}
        </div>
        <div className="text-ink-tertiary/50 transition-transform duration-200 shrink-0 ml-2" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
          <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} />
        </div>
      </div>

      {expanded && (
        <div
          className="mt-3 pt-3 space-y-1.5"
          style={{ borderTop: `1px solid ${STS_BORDER[color]}` }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "Est. base monthly income",        value: data.breakdown.monthly_income, sign: "+" },
            { label: "Spent this month",               value: data.breakdown.spent_this_month, sign: "−" },
            { label: "Upcoming bills this month",      value: data.breakdown.upcoming_bills,  sign: "−" },
            { label: "Goal savings (monthly share)",   value: data.breakdown.goal_savings,    sign: "−" },
          ].map(({ label, value, sign }) => (
            <div key={label} className="flex justify-between">
              <span className="text-[12px] text-ink-secondary">{label}</span>
              <span className={`text-[12px] font-mono ${sign === "+" ? "text-semantic-income" : "text-ink-tertiary"}`}>
                {sign}{fmt(value)}
              </span>
            </div>
          ))}
          <div
            className="flex justify-between pt-2 mt-1"
            style={{ borderTop: `1px solid ${STS_BORDER[color]}` }}
          >
            <span className="text-[12px] font-semibold text-ink-primary">Safe to spend</span>
            <div className="text-right">
              <span className="text-[12px] font-bold font-mono" style={{ color: STS_COLOR[color] }}>
                {isNegative ? "-" : ""}{fmt(Math.abs(data.safe_to_spend))}
              </span>
              {dailyAllowance !== null && (
                <p className="text-[11px] text-ink-tertiary">{fmt(dailyAllowance)}/day for {data.days_remaining} days</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Insights feed ─────────────────────────────────────────────────────────────

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  spending_spike:           <TrendingUp size={13} />,
  budget_alert:             <AlertTriangle size={13} />,
  large_transaction:        <Info size={13} />,
  subscription_price_change:<TrendingUp size={13} />,
  reward_threshold:         <Zap size={13} />,
};

const INSIGHT_COLOR: Record<string, string> = {
  spending_spike:           "var(--color-expense)",
  budget_alert:             "var(--color-warning, #D4921A)",
  large_transaction:        "var(--color-ink-secondary)",
  subscription_price_change:"var(--color-warning, #D4921A)",
  reward_threshold:         "var(--color-honey)",
};

function insightHref(ins: Insight): string | null {
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  switch (ins.insight_type) {
    case "spending_spike":
      return ins.category
        ? `/transactions?category=${encodeURIComponent(ins.category)}&month=${month}`
        : "/transactions";
    case "large_transaction":
      return ins.linked_entity_id
        ? `/transactions?search=${encodeURIComponent(ins.title.replace(/^Large transaction: /i, ""))}&search_all=true&open_tx=${ins.linked_entity_id}`
        : "/transactions";
    case "budget_alert":
      return ins.category ? `/budgets?category=${encodeURIComponent(ins.category)}` : "/budgets";
    case "subscription_price_change":
      return ins.linked_entity_id ? `/subscriptions?id=${ins.linked_entity_id}` : "/subscriptions";
    case "reward_threshold":
      return ins.linked_entity_id ? `/points?program=${encodeURIComponent(ins.linked_entity_id)}` : "/points";
    default:
      return "/insights";
  }
}

function InsightsFeed({ insights, onDismiss }: { insights: Insight[]; onDismiss: (id: string) => void }) {
  const router = useRouter();
  if (insights.length === 0) return null;

  return (
    <div className="px-6 py-3 border-b border-white/[0.04]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em]">Insights</p>
        <Link href="/insights" className="text-[10px] text-honey/70 hover:text-honey transition-colors no-underline">
          View all →
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {insights.map((ins) => {
          const iconColor = INSIGHT_COLOR[ins.insight_type] ?? "var(--color-ink-secondary)";
          const href = insightHref(ins);
          return (
            <div
              key={ins.id}
              className="hive-card shrink-0 w-[220px] px-3 py-2.5 relative cursor-pointer hover:bg-white/[0.03] transition-colors"
              style={{ opacity: ins.is_read ? 0.65 : 1 }}
              onClick={() => { if (href) router.push(href); }}
            >
              <div className="flex items-start gap-2 mb-1">
                <span style={{ color: iconColor }} className="mt-0.5 shrink-0">
                  {INSIGHT_ICON[ins.insight_type] ?? <Info size={13} />}
                </span>
                <span className="text-[12px] font-semibold text-ink-primary leading-snug flex-1">
                  {ins.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(ins.id); }}
                  className="text-ink-ghost hover:text-ink-tertiary transition-colors shrink-0 p-0 bg-transparent border-0 cursor-pointer"
                  aria-label="Dismiss"
                >
                  <X size={11} />
                </button>
              </div>
              <p className="text-[11px] text-ink-tertiary leading-snug">
                {ins.body}
              </p>
              {ins.amount != null && (
                <div style={{ color: iconColor }} className="mt-1.5 text-[12px] font-semibold font-mono">
                  {fmt(Math.abs(ins.amount))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section header style helper ───────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em] mb-3">
      {children}
    </p>
  );
}

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
  const paceLabel = paceRatio > 1.2 ? `${Math.round((paceRatio - 1) * 100)}% over pace` : paceRatio > 0.9 ? "On pace" : "Good";
  const paceBadgeClass = paceRatio > 1.2
    ? "bg-semantic-expense/10 text-semantic-expense border-semantic-expense/20"
    : paceRatio > 0.9
    ? "bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20"
    : "bg-semantic-income/10 text-semantic-income border-semantic-income/20";

  return (
    <Link
      href={`/transactions?category=${encodeURIComponent(category)}`}
      className="block py-3 hover:bg-white/[0.02] -mx-5 px-5 rounded-lg transition-colors no-underline group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAT_DOT[category] ?? "#6b7285" }} />
          <span className="text-[13px] text-ink-secondary font-medium truncate group-hover:text-ink-primary transition-colors">{category}</span>
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
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const month = currentMonth();
  const currentMonthLabel = monthLabel(month);

  const [accts, setAccts]       = useState<Account[]>([]);
  const [bdgts, setBdgts]       = useState<Budget[]>([]);
  const [pts, setPts]           = useState<PointsSummary | null>(null);
  const [spendData, setSpendData] = useState<{ category: string; spend: number }[]>([]);
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [nwHistory, setNwHistory]       = useState<{ snapshot_date: string; net_worth: number }[]>([]);
  const [uncategorized, setUncategorized] = useState<Transaction[]>([]);
  const [anomalies, setAnomalies]         = useState<Anomaly[]>([]);
  const [safeToSpend, setSafeToSpend]     = useState<SafeToSpend | null>(null);
  const [insights, setInsights]           = useState<Insight[]>([]);
  const [paceAlerts, setPaceAlerts]       = useState<PaceAlert[]>([]);
  const [healthScore, setHealthScore]     = useState<HealthScore | null>(null);
  const [weeklyComp, setWeeklyComp]       = useState<WeeklyComparison | null>(null);
  const [topMerchants, setTopMerchants]   = useState<MerchantSummary[]>([]);
  const [position, setPosition]           = useState<MonthlyPosition | null>(null);
  const [loading, setLoading]   = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.accounts.list(),
      api.budgets.list(month),
      api.points.summary(),
      api.transactions.spendByCategory(month),
      api.goals.list(),
      api.netWorth.history(),
      api.transactions.list({ category: "Uncategorized", page_size: 5 }),
      api.anomalies.list("unreviewed"),
      api.dashboard.safeToSpend(),
      api.insights.list(8),
    ]).then(([accountsRes, budgetsRes, pointsRes, spendRes, goalsRes, nwHistoryRes, uncatRes, anomaliesRes, stsRes, insightsRes]) => {
      if (accountsRes.status === "fulfilled") setAccts(accountsRes.value);
      if (budgetsRes.status  === "fulfilled") setBdgts(budgetsRes.value);
      if (pointsRes.status   === "fulfilled") setPts(pointsRes.value);
      if (spendRes.status    === "fulfilled") setSpendData(spendRes.value);
      if (goalsRes.status    === "fulfilled") setGoals(goalsRes.value);
      if (nwHistoryRes.status === "fulfilled") setNwHistory(nwHistoryRes.value);
      if (uncatRes.status    === "fulfilled") setUncategorized(uncatRes.value.items);
      if (anomaliesRes.status === "fulfilled") setAnomalies(anomaliesRes.value);
      if (stsRes.status       === "fulfilled") setSafeToSpend(stsRes.value);
      if (insightsRes.status  === "fulfilled") setInsights(insightsRes.value.insights);
      // Non-critical: pace alerts + health score load separately
      api.dashboard.paceAlerts().then(setPaceAlerts).catch(() => {});
      api.dashboard.healthScore().then(setHealthScore).catch(() => {});
      api.dashboard.weeklyComparison().then(setWeeklyComp).catch(() => {});
      api.merchants.list({ days: 30, limit: 6 }).then(setTopMerchants).catch(() => {});
      api.position.monthly(month).then(setPosition).catch(() => {});
      if (accountsRes.status === "rejected" || budgetsRes.status === "rejected") {
        setCriticalError("Some data failed to load. Check your connection or try refreshing.");
      }
      setLoading(false);
    });
  }, [month]);

  function handleDismissInsight(id: string) {
    api.insights.dismiss(id).catch(() => {});
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  const creditCards  = accts.filter((a) => a.type === "credit");
  const liquidAccts  = accts.filter((a) => a.type === "depository" && ["checking", "savings"].includes(a.subtype ?? ""));
  const investAccts  = accts.filter((a) => a.type === "investment" || a.type === "brokerage");
  const otherAssets  = accts.filter((a) => {
    if (a.type === "credit" || a.type === "investment" || a.type === "brokerage") return false;
    if (a.type === "depository" && ["checking", "savings"].includes(a.subtype ?? "")) return false;
    return true; // CDs, money market, manual accounts, "other" type, depository with no subtype
  });
  const totalLiquid  = liquidAccts.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const totalCredit  = creditCards.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const totalAssets  = accts.filter((a) => a.type !== "credit").reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const pointsValue = pts?.total_estimated_value_dollars ?? 0;
  const alerts      = pts?.programs.filter((p) => p.above_threshold) ?? [];
  const noAccounts  = !loading && accts.length === 0;

  const spendItems = spendData.filter((d) => d.category !== "Transfers" && d.category !== "Uncategorized").slice(0, 6);
  const maxSpend   = Math.max(...spendItems.map((b) => b.spend), 1);

  const pctMonthElapsed = (() => {
    const now = new Date();
    return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  })();

  return (
    <div className="animate-fade-in" style={{ position: "relative" }}>

      {/* ── Critical error ───────────────────────────────────────────── */}
      {criticalError && (
        <div className="hive-card flex items-center gap-3 p-4 mx-6 mt-4 rounded-xl border-semantic-expense/20">
          <AlertTriangle className="w-4 h-4 text-semantic-expense flex-shrink-0" />
          <p className="text-[13px] text-semantic-expense">{criticalError}</p>
          <button onClick={() => window.location.reload()} className="ml-auto hive-btn-ghost text-[12px]">Retry</button>
        </div>
      )}

      {/* ── Zone 1: Status strip ────────────────────────────────── */}
      {(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const pctMonth = Math.round((now.getDate() / daysInMonth) * 100);
        const totalBudget = bdgts.reduce((s, b) => s + b.budget_amount, 0);
        const totalSpent  = bdgts.reduce((s, b) => s + b.actual_spend, 0);
        const pctBurned   = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
        const budgetOk    = totalBudget === 0 || pctBurned <= pctMonth + 5;
        const nwVal       = nwHistory.length > 0 ? nwHistory[nwHistory.length - 1].net_worth : (totalAssets - totalCredit);
        const nwDelta     = nwHistory.length >= 2
          ? nwVal - nwHistory[Math.max(0, nwHistory.length - 31)].net_worth
          : null;

        const monthSaved = position ? position.available_to_save : 0;
        const monthIncome = safeToSpend ? safeToSpend.breakdown.monthly_income : 0;
        const monthSpent = safeToSpend ? safeToSpend.breakdown.spent_this_month : 0;

        const KPIS = [
          {
            label: "Net Worth",
            value: fmt(nwVal),
            href:  "/net-worth",
            color: undefined as string | undefined,
            sub:   nwDelta !== null
              ? { text: `${nwDelta >= 0 ? "↑" : "↓"} ${fmt(Math.abs(nwDelta))} · 30d`, color: nwDelta >= 0 ? "var(--color-income)" : "var(--color-expense)" }
              : { text: "updated daily", color: "var(--color-ink-tertiary)" },
          },
          {
            label: "Monthly Income",
            value: safeToSpend ? fmt(safeToSpend.breakdown.monthly_income) : "—",
            href:  "/income",
            color: safeToSpend && safeToSpend.breakdown.monthly_income > 0 ? "var(--color-income)" : undefined,
            sub:   { text: "base pay est.", color: "var(--color-ink-tertiary)" },
          },
          {
            label: "Saved",
            value: position ? (monthSaved >= 0 ? fmt(monthSaved) : `−${fmt(Math.abs(monthSaved))}`) : "—",
            href:  "/cash-flow",
            color: monthSaved >= 0 ? "var(--color-income)" : "var(--color-expense)",
            sub:   { text: monthIncome > 0 ? `${fmt(monthIncome)} in · ${fmt(monthSpent)} out` : `${pctMonth}% of month elapsed`, color: "var(--color-ink-tertiary)" },
          },
          {
            label: "Liquid Cash",
            value: fmt(totalLiquid),
            href:  "/cash-flow",
            color: undefined as string | undefined,
            sub:   { text: `${fmt(totalCredit)} credit balance`, color: "var(--color-ink-tertiary)" },
          },
        ];

        return (
          <div className="flex items-start gap-4 md:gap-10 px-4 md:px-6 pt-[18px] pb-[14px] border-b border-white/[0.04] overflow-x-auto">
            {KPIS.map(({ label, value, href, color, sub }) => (
              <div key={label} className="cursor-pointer group shrink-0" onClick={() => router.push(href)}>
                <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em] mb-[5px] group-hover:text-ink-secondary transition-colors">{label}</p>
                <p className="text-[20px] md:text-[24px] font-bold font-mono leading-none tracking-[-0.02em] group-hover:opacity-80 transition-opacity" style={{ color: color ?? "var(--color-ink-primary)" }}>
                  {value}
                </p>
                <p className="text-[11px] mt-1 whitespace-nowrap" style={{ color: sub.color }}>{sub.text}</p>
              </div>
            ))}
            <div className="ml-auto flex items-start gap-2 pt-0.5 shrink-0">
              {alerts.length > 0 && (
                <Link href="/points" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-honey bg-honey/[0.08] border border-honey/20 no-underline">
                  <Bell size={12} />{alerts.length} reward{alerts.length > 1 ? "s" : ""} ready
                </Link>
              )}
              <Link href="/connect" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-secondary bg-surface border border-white/[0.08] no-underline hover:text-ink-primary transition-colors">
                <Link2 size={12} />{noAccounts ? "Connect account" : "Add account"}
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── Safe to Spend ──────────────────────────────────────────── */}
      {safeToSpend && !noAccounts && (
        <div className="py-3 border-b border-white/[0.04]">
          <SafeToSpendCard data={safeToSpend} />
        </div>
      )}

      {/* ── Monthly Position ───────────────────────────────────────── */}
      {position && !noAccounts && (
        <div
          className="mx-6 my-3 rounded-xl px-[18px] py-[14px] cursor-pointer select-none border border-white/[0.06] hover:bg-white/[0.02] transition-colors"
          onClick={() => router.push("/position")}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1 text-ink-tertiary">
            Monthly Position
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-[28px] font-bold font-mono leading-none",
              position.available_to_save >= 0 ? "text-semantic-income" : "text-semantic-expense"
            )}>
              {position.available_to_save >= 0 ? "" : "−"}{fmt(Math.abs(position.available_to_save))}
            </span>
            <span className="text-[12px] text-ink-tertiary">
              {position.available_to_save >= 0 ? "available to save" : "over budget"}
            </span>
          </div>
          {position.pending_reimbursements_total > 0 && (
            <p className="text-[11px] text-semantic-income mt-1">
              +{fmt(position.pending_reimbursements_total)} owed to you
            </p>
          )}
        </div>
      )}

      {/* ── Insights feed ──────────────────────────────────────────── */}
      {insights.length > 0 && !noAccounts && (
        <InsightsFeed insights={insights} onDismiss={handleDismissInsight} />
      )}

      {/* ── Zone 2: Action Items ────────────────────────────────────── */}
      {(uncategorized.length > 0 || anomalies.length > 0 || paceAlerts.length > 0) && (
        <div className="px-6 py-3 border-b border-white/[0.04] flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-[0.08em] mb-0.5">Needs attention</p>
          {paceAlerts.map((alert) => (
            <div key={alert.category} className="hive-card px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${alert.severity === "danger" ? "bg-semantic-expense" : "bg-semantic-warning"}`} />
                <span className="text-[12px] text-ink-primary">
                  {alert.category} on pace for <span className="font-mono">{fmt(alert.projected_spend)}</span>
                  <span className="text-ink-tertiary ml-1">
                    (<span className="font-mono">{alert.pct_projected.toFixed(0)}%</span> of <span className="font-mono">{fmt(alert.budget_amount)}</span> budget)
                  </span>
                </span>
              </div>
              <Link href={`/budgets?category=${encodeURIComponent(alert.category)}`} className="text-[11px] text-honey hover:text-honey/80 transition-colors no-underline">
                Budgets →
              </Link>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div className="hive-card px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-semantic-warning shrink-0" />
                <span className="text-[12px] text-ink-primary">
                  {uncategorized.length === 5 ? "5+" : uncategorized.length} uncategorized transaction{uncategorized.length > 1 ? "s" : ""}
                </span>
              </div>
              <Link href="/transactions?category=Uncategorized" className="text-[11px] text-honey hover:text-honey/80 transition-colors no-underline">
                Review →
              </Link>
            </div>
          )}
          {anomalies.slice(0, 2).map((a) => (
            <div key={a.id} className="hive-card px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-semantic-expense shrink-0" />
                <span className="text-[12px] text-ink-primary">
                  Unusual charge: {a.transaction?.merchant ?? a.transaction?.raw_description ?? "Unknown"}{a.transaction ? <> · <span className="font-mono">{fmt(a.transaction.amount)}</span></> : ""}
                </span>
              </div>
              <Link
                href={a.transaction_id
                  ? `/transactions?open_tx=${a.transaction_id}&search_all=true${a.transaction?.merchant ? `&search=${encodeURIComponent(a.transaction.merchant)}` : ""}`
                  : "/anomalies"}
                className="text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors no-underline"
              >
                Review →
              </Link>
            </div>
          ))}
        </div>
      )}

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
          <Link href="/connect" className="hive-btn-primary px-6 py-2.5 text-[13px] mb-8">Connect Accounts</Link>
          <div className="grid grid-cols-3 gap-3 max-w-xl w-full">
            {[
              { title: "Track Spending",   desc: "Every transaction, auto-categorized" },
              { title: "Optimize Rewards", desc: "Always use the right card" },
              { title: "Ask AI",           desc: "Chat with your finances" },
            ].map((f) => (
              <div key={f.title} className="hive-card p-4 text-center">
                <p className="text-[12px] font-semibold text-ink-primary mb-1">{f.title}</p>
                <p className="text-[11px] text-ink-tertiary leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main 2-column grid ───────────────────────────────────────── */}
      {!noAccounts && (
        <div className="grid grid-cols-[3fr_2fr] gap-4 p-5 px-6">

          {/* ── Left column ──────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* Spending Breakdown */}
            {(loading || spendItems.length > 0) && (
              <div className="hive-card overflow-hidden p-4">
                <div className="hive-section-header mb-0">
                  <SectionLabel>Spending · {currentMonthLabel}</SectionLabel>
                  {!loading && <Link href="/reports" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">Reports <ChevronRight className="w-3 h-3" /></Link>}
                </div>
                {loading ? (
                  <div className="space-y-2.5 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                        <div className="w-24 h-3 rounded bg-white/[0.06] animate-pulse shrink-0" />
                        <div className="flex-1 h-1 bg-white/[0.05] rounded-full" />
                        <div className="w-14 h-3 rounded bg-white/[0.06] animate-pulse shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {spendItems.map((item, i) => (
                      <Link
                        key={item.category}
                        href={`/transactions?category=${encodeURIComponent(item.category)}`}
                        className="flex items-center gap-3 -mx-1 px-1 py-0.5 rounded hover:bg-white/[0.03] transition-colors no-underline group"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLOR[item.category] ?? "#4B5063" }} />
                        <span className="text-[12px] text-ink-secondary w-[112px] shrink-0 truncate group-hover:text-ink-primary transition-colors">{item.category}</span>
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
                      </Link>
                    ))}
                    {(() => {
                      if (!safeToSpend || loading) return null;
                      const creditOnlyTotal = spendItems.reduce((s, i) => s + i.spend, 0);
                      const debitGap = safeToSpend.breakdown.spent_this_month - creditOnlyTotal;
                      if (debitGap < 10) return null;
                      return (
                        <div className="flex items-center gap-3 mt-1 pt-2 border-t border-white/[0.04]">
                          <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                          <span className="text-[12px] text-ink-tertiary w-[112px] shrink-0">Debit / Checking</span>
                          <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((debitGap / Math.max(maxSpend, debitGap)) * 100, 100)}%`,
                                background: "rgba(255,255,255,0.15)",
                              }}
                            />
                          </div>
                          <span className="text-[12px] font-mono text-ink-tertiary tabular-nums w-16 text-right shrink-0">
                            {fmt(debitGap)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Top Merchants */}
            {topMerchants.length > 0 && (
              <div className="hive-card overflow-hidden p-4">
                <div className="hive-section-header mb-3">
                  <SectionLabel>Top Merchants · 30d</SectionLabel>
                  <Link href="/merchants" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                    All <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {topMerchants.map((m, i) => {
                    const maxSpendM = topMerchants[0]?.total_spent ?? 1;
                    return (
                      <Link
                        key={m.merchant_name}
                        href={`/merchants?m=${encodeURIComponent(m.merchant_name)}`}
                        className="flex items-center gap-2.5 -mx-1 px-1 py-0.5 rounded hover:bg-white/[0.03] transition-colors no-underline group"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <span className="text-[11px] font-mono text-ink-ghost w-4 shrink-0 text-right">{i + 1}</span>
                        <span className="text-[12px] text-ink-secondary flex-1 truncate group-hover:text-ink-primary transition-colors">{m.merchant_name}</span>
                        <div className="w-20 h-1 bg-white/[0.04] rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-honey/40 rounded-full"
                            style={{ width: `${(m.total_spent / maxSpendM) * 100}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-mono text-ink-tertiary tabular-nums w-16 text-right shrink-0">
                          {fmt(m.total_spent)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Account Balances */}
            {accts.filter((a) => a.type !== "credit").length > 0 && (
              <div className="hive-card overflow-hidden p-4">
                <div className="hive-section-header mb-3">
                  <SectionLabel>Account Balances</SectionLabel>
                  <Link href="/connect" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                    Manage <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                {[
                  { label: "Liquid", items: liquidAccts },
                  { label: "Investments", items: investAccts },
                  { label: "Other", items: otherAssets },
                ].filter((g) => g.items.length > 0).map((group) => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-ghost mb-1.5">{group.label}</p>
                    <div className="space-y-1.5">
                      {group.items.map((a) => (
                        <Link
                          key={a.id}
                          href={`/transactions?account_id=${a.id}&search_all=true&include_excluded=true`}
                          title={`View ${a.name} transactions`}
                          className="flex items-center justify-between gap-2 no-underline rounded-md -mx-1 px-1 py-0.5 hover:bg-white/[0.03] transition-colors group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-ink-secondary truncate group-hover:text-honey transition-colors">{a.name}</p>
                            {a.institution && (
                              <p className="text-[10px] text-ink-ghost truncate">{a.institution}{a.subtype ? ` · ${a.subtype}` : ""}</p>
                            )}
                          </div>
                          <span className="text-[12px] font-mono tabular-nums text-ink-primary shrink-0">
                            {fmt(a.current_balance ?? 0)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Credit Utilization */}
            {creditCards.length > 0 && (
              <div className="hive-card overflow-hidden p-4">
                <div className="hive-section-header mb-2">
                  <SectionLabel>Credit Utilization</SectionLabel>
                  <Link href="/connect" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                    Accounts <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {creditCards.map((card) => {
                    const used = card.current_balance ?? 0;
                    const limit = card.credit_limit && card.credit_limit > 0 ? card.credit_limit : null;
                    const pct = limit ? Math.min((used / limit) * 100, 100) : null;
                    const barColor = pct !== null
                      ? (pct >= 90 ? "var(--color-expense)" : pct >= 70 ? "var(--color-warning, #D4921A)" : "var(--color-income)")
                      : "var(--color-income)";
                    return (
                      <div key={card.id}>
                        <div className="flex items-center justify-between mb-1">
                          <Link
                            href={`/transactions?account_id=${card.id}&search_all=true`}
                            className="text-[12px] text-ink-secondary truncate mr-2 max-w-[140px] hover:text-honey transition-colors no-underline"
                            title={`View ${card.name} transactions`}
                          >
                            {card.name}
                          </Link>
                          <span className="text-[11px] font-mono text-ink-tertiary tabular-nums shrink-0">
                            {limit ? `${fmt(used)} / ${fmt(limit)}` : fmt(used)}
                          </span>
                        </div>
                        {limit !== null ? (
                          <>
                            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-[width] duration-400" style={{ width: `${pct}%`, background: barColor }} />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-ink-tertiary font-mono">{pct!.toFixed(0)}% used</span>
                              <span className="text-[10px] text-ink-ghost font-mono">{fmt(limit - used)} available</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-[10px] text-ink-ghost mt-0.5">No preset limit</p>
                        )}
                      </div>
                    );
                  })}
                  {/* Overall utilization */}
                  {(() => {
                    const totalLimit = creditCards.filter(c => c.credit_limit && c.credit_limit > 0).reduce((s, c) => s + (c.credit_limit ?? 0), 0);
                    const overallPct = totalLimit > 0 ? ((totalCredit / totalLimit) * 100) : 0;
                    return totalLimit > 0 ? (
                      <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                        <span className="text-[10px] text-ink-tertiary uppercase tracking-wide">Overall</span>
                        <span className={`text-[12px] font-mono font-semibold tabular-nums ${overallPct >= 30 ? "text-semantic-expense" : "text-semantic-income"}`}>
                          {overallPct.toFixed(1)}%
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {/* Financial Health Score */}
            {healthScore && (
              <div className="hive-card overflow-hidden p-4">
                <div className="hive-section-header mb-3">
                  <SectionLabel>Financial Health</SectionLabel>
                  <div className={`text-[13px] font-bold px-2 py-0.5 rounded-md ${
                    healthScore.score >= 70 ? "bg-semantic-income/10 text-semantic-income"
                    : healthScore.score >= 45 ? "bg-semantic-warning/10 text-semantic-warning"
                    : "bg-semantic-expense/10 text-semantic-expense"
                  }`}>
                    {healthScore.grade} · {healthScore.score}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {healthScore.factors.map((factor) => {
                    const barColor = factor.color === "green"
                      ? "var(--color-income)"
                      : factor.color === "amber"
                      ? "var(--color-honey)"
                      : "var(--color-expense)";
                    return (
                      <div key={factor.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-ink-secondary">{factor.name}</span>
                          <span className="text-[11px] text-ink-tertiary truncate ml-2 text-right max-w-[160px]">
                            {factor.description}
                          </span>
                        </div>
                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${factor.score}%`, background: barColor, opacity: 0.8 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>{/* end left column */}

          {/* ── Right column ─────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* Budgets */}
            <div className="hive-card overflow-hidden">
              <div className="hive-section-header">
                <SectionLabel>Budgets</SectionLabel>
                <Link href="/budgets" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                  Manage <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {bdgts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[13px] text-ink-secondary mb-1">No budgets set</p>
                  <p className="text-[12px] text-ink-tertiary mb-4">Set monthly spending limits to track progress.</p>
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

            {/* Weekly Comparison */}
            {weeklyComp && (weeklyComp.this_week_total > 0 || weeklyComp.last_week_total > 0) && (
              <div className="hive-card overflow-hidden p-4">
                <div className="hive-section-header mb-3">
                  <SectionLabel>This Week</SectionLabel>
                  <Link href="/cash-flow" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                    Cash Flow <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[22px] font-bold font-mono tabular-nums text-ink-primary leading-none">
                      {fmt(weeklyComp.this_week_total)}
                    </p>
                    <p className="text-[11px] text-ink-tertiary mt-1">
                      {weeklyComp.days_elapsed_this_week} day{weeklyComp.days_elapsed_this_week !== 1 ? "s" : ""} so far
                    </p>
                  </div>
                  {weeklyComp.last_week_total > 0 && (
                    <div className="text-right">
                      <p className={`text-[13px] font-semibold font-mono tabular-nums ${weeklyComp.delta > 0 ? "text-semantic-expense" : "text-semantic-income"}`}>
                        {weeklyComp.delta > 0 ? "+" : ""}{fmt(weeklyComp.delta)}
                      </p>
                      <p className="text-[10px] text-ink-ghost">vs last week</p>
                    </div>
                  )}
                </div>
                {/* Mini sparkline bars for each day Mon–Sun */}
                <div className="flex items-end gap-1 h-10">
                  {(() => {
                    const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
                    const maxAmt = Math.max(
                      ...weeklyComp.this_week_days.map(d => d.total),
                      ...weeklyComp.last_week_days.map(d => d.total),
                      1
                    );
                    const todayDow = new Date().getDay(); // 0=Sun
                    const thisDow = todayDow === 0 ? 6 : todayDow - 1; // convert to Mon=0
                    return DAY_LABELS.map((label, i) => {
                      const thisDay = weeklyComp.this_week_days[i];
                      const lastDay = weeklyComp.last_week_days[i];
                      const thisH = thisDay ? Math.max((thisDay.total / maxAmt) * 36, thisDay.total > 0 ? 3 : 0) : 0;
                      const lastH = lastDay ? Math.max((lastDay.total / maxAmt) * 36, lastDay.total > 0 ? 3 : 0) : 0;
                      const isToday = i === thisDow;
                      const isFuture = i > thisDow;
                      const canClick = !isFuture && thisDay?.total > 0;
                      return (
                        <div
                          key={i}
                          className={cn("flex-1 flex flex-col items-center gap-1", canClick && "cursor-pointer group")}
                          onClick={canClick ? () => router.push(`/transactions?start_date=${thisDay.date}&end_date=${thisDay.date}&search_all=true`) : undefined}
                          title={canClick ? `${label} · ${fmt(thisDay.total)}` : undefined}
                        >
                          <div className="w-full flex items-end gap-0.5 h-9">
                            {/* Last week bar */}
                            <div
                              className="flex-1 rounded-sm opacity-30"
                              style={{ height: `${lastH}px`, background: "rgba(255,255,255,0.3)", minHeight: lastH > 0 ? 3 : 0 }}
                            />
                            {/* This week bar */}
                            <div
                              className={cn(
                                `flex-1 rounded-sm`,
                                isFuture ? "opacity-10" : isToday ? "opacity-100" : "opacity-70",
                                canClick && "group-hover:opacity-100 transition-opacity"
                              )}
                              style={{
                                height: `${thisH}px`,
                                background: weeklyComp.delta > 0 ? "var(--color-expense, #ef4444)" : "var(--color-income, #2d9e72)",
                                minHeight: thisH > 0 ? 3 : 0,
                              }}
                            />
                          </div>
                          <span className={`text-[9px] ${isToday ? "text-ink-secondary font-bold" : "text-ink-ghost"}`}>{label}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                {weeklyComp.last_week_total > 0 && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2 rounded-sm" style={{ background: weeklyComp.delta > 0 ? "var(--color-expense)" : "var(--color-income)" }} />
                      <span className="text-[10px] text-ink-ghost">This week</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2 rounded-sm bg-white/30" />
                      <span className="text-[10px] text-ink-ghost">Last week · {fmt(weeklyComp.last_week_total)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Goals */}
            {goals.length > 0 && (
              <div className="hive-card overflow-hidden">
                <div className="hive-section-header">
                  <SectionLabel>Goals</SectionLabel>
                  <Link href="/goals" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                    Manage <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="px-5 pb-3 space-y-4">
                  {goals.filter((g) => !g.archived).slice(0, 4).map((g) => (
                    <Link key={g.id} href="/goals" className="block no-underline -mx-1 px-1 py-1 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] text-ink-primary font-medium truncate mr-2">{g.name}</span>
                        <span className="text-[11px] font-mono text-ink-tertiary shrink-0 tabular-nums">
                          {fmt(g.current_amount)} / {fmt(g.target_amount)}
                        </span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-400"
                          style={{ width: `${Math.min(g.pct_complete, 100)}%`, background: g.pct_complete >= 100 ? "var(--color-income)" : "var(--color-honey)" }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-ink-tertiary font-mono">{g.pct_complete.toFixed(0)}% complete</span>
                        {g.deadline && (
                          <span className="text-[10px] text-ink-ghost">Due {g.deadline}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Points Programs */}
            <div className="hive-card overflow-hidden">
              <div className="hive-section-header">
                <SectionLabel>Points Programs</SectionLabel>
                <Link href="/points" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                  Details <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {!pts || pts.programs.length === 0 ? (
                <p className="px-5 py-8 text-[12px] text-ink-tertiary text-center">No points data available</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {pts.programs.map((p) => (
                    <Link key={p.program} href="/points" className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors no-underline">
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
                        {fmt(p.estimated_value_dollars)}
                      </p>
                    </Link>
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

          </div>{/* end right column */}

        </div>
      )}

    </div>
  );
}
