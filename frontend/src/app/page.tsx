"use client";

import { useEffect, useState, useRef } from "react";
import { api, Account, Budget, PointsSummary, Transaction } from "@/lib/api";
import { fmt, previousMonth, monthLabel, fmtDate } from "@/lib/utils";
import Link from "next/link";
import {
  Landmark,
  CreditCard,
  Gem,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
  Link2,
  Bell,
  ChevronRight,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GlassCard } from "@/components/GlassCard";

// ── Category colors ──────────────────────────────────────────────────────────

const CAT_BAR: Record<string, string> = {
  "Food & Drink":   "bg-orange-400",
  "Groceries":      "bg-emerald-400",
  "Travel":         "bg-sky-400",
  "Transportation": "bg-yellow-400",
  "Entertainment":  "bg-violet-400",
  "Shopping":       "bg-pink-400",
  "Health":         "bg-rose-400",
  "Utilities":      "bg-ink-secondary",
  "Home":           "bg-teal-400",
  "Education":      "bg-indigo-400",
  "Personal Care":  "bg-fuchsia-400",
  "Business":       "bg-cyan-400",
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

// ── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tint: "income" | "expense" | "amber" | "sky";
}) {
  const accentMap = {
    income:  "rgba(50,213,131,0.12)",
    expense: "rgba(249,112,102,0.12)",
    amber:   "rgba(245,185,66,0.12)",
    sky:     "rgba(56,189,248,0.12)",
  };
  const accent = accentMap[tint];

  return (
    <GlassCard tint={tint} className="p-5 relative overflow-hidden group">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="hive-label">{label}</span>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: accent }}
          >
            <Icon className="w-3.5 h-3.5 text-ink-primary/80" />
          </div>
        </div>
        <p className="text-[28px] font-semibold font-mono tracking-tight text-ink-primary leading-none">
          {value}
        </p>
        {sub && (
          <p className="mt-2 text-[12px] text-ink-tertiary leading-snug">{sub}</p>
        )}
      </div>
    </GlassCard>
  );
}

// ── Budget Row ───────────────────────────────────────────────────────────────

function BudgetRow({
  category,
  actual,
  budget,
  pct,
  index,
}: {
  category: string;
  actual: number;
  budget: number;
  pct: number;
  index: number;
}) {
  const over = pct > 100;
  const warn = pct > 80 && !over;

  const barColor = over
    ? "linear-gradient(90deg, #F87171, #EF4444)"
    : warn
    ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
    : "linear-gradient(90deg, #34D399, #10B981)";

  const pctColor = over
    ? "text-semantic-expense"
    : warn
    ? "text-semantic-warning"
    : "text-semantic-income";

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CAT_DOT[category] ?? "bg-ink-tertiary"}`} />
          <span className="text-[13px] text-ink-secondary font-medium truncate">{category}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className={`text-[11px] font-semibold font-mono ${pctColor}`}>{pct.toFixed(0)}%</span>
          <span className="text-[11px] font-mono text-ink-tertiary">
            {fmt(actual)}<span className="mx-1 opacity-30">/</span>{fmt(budget)}
          </span>
        </div>
      </div>
      <AnimatedBar
        pct={Math.min(pct, 100)}
        color={barColor}
        height={3}
        delay={index * 60}
      />
    </div>
  );
}

// ── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  account: a,
  isCredit,
  onDragStart,
  onDrop,
}: {
  account: Account;
  isCredit: boolean;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(a.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(a.id)}
      className="relative"
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-ink-tertiary/40" />
      </div>
      <Link
        href={`/transactions?account_id=${a.id}`}
        className={`group relative overflow-hidden rounded-[14px] p-4 block
                   bg-gradient-to-br border border-white/[0.06] transition-all duration-200
                   ${isCredit
                     ? "from-honey/[0.05] via-transparent to-transparent hover:border-honey/20 hover:from-honey/[0.09]"
                     : "from-semantic-income/[0.05] via-transparent to-transparent hover:border-semantic-income/20 hover:from-semantic-income/[0.09]"
                   }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-5">
            <div className="min-w-0">
              <p className={`text-[9px] font-semibold tracking-[0.12em] uppercase ${isCredit ? "text-honey/50" : "text-semantic-income/50"}`}>
                {a.institution || (a.is_manual ? "Manual" : "Bank")}
              </p>
              <p className="text-[12px] font-medium text-ink-primary mt-0.5 truncate">
                {isCredit ? (a.official_name ?? a.name) : a.name}
              </p>
            </div>
            {isCredit
              ? <CreditCard className="w-4 h-4 text-ink-tertiary/40 group-hover:text-honey/50 transition-colors shrink-0" />
              : <Landmark   className="w-4 h-4 text-ink-tertiary/40 group-hover:text-semantic-income/50 transition-colors shrink-0" />
            }
          </div>
          {a.mask && (
            <p className="text-[10px] font-mono text-ink-tertiary/40 mb-1 tracking-[0.18em]">
              •••• {a.mask}
            </p>
          )}
          <p className="text-[18px] font-semibold font-mono text-ink-primary leading-none">
            {fmt(a.current_balance ?? 0)}
          </p>
          {isCredit && a.credit_limit ? (
            <p className="text-[10px] text-ink-tertiary/50 mt-0.5">
              of {fmt(a.credit_limit)} limit
            </p>
          ) : (
            <p className="text-[10px] text-ink-tertiary/50 mt-0.5 capitalize">
              {a.subtype ?? a.type}
            </p>
          )}
        </div>
        <ArrowRight className={`absolute bottom-3 right-3 w-3 h-3 text-ink-tertiary/30 group-hover:translate-x-0.5 transition-all duration-150 ${isCredit ? "group-hover:text-honey/60" : "group-hover:text-semantic-income/60"}`} />
      </Link>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const ACCT_ORDER_KEY = "hive_acct_order";

function loadAcctOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(ACCT_ORDER_KEY) ?? "[]"); } catch { return []; }
}

function saveAcctOrder(ids: string[]) {
  localStorage.setItem(ACCT_ORDER_KEY, JSON.stringify(ids));
}

function applyOrder(accounts: Account[], order: string[]): Account[] {
  if (!order.length) return accounts;
  const map = new Map(accounts.map((a) => [a.id, a]));
  const ordered = order.filter((id) => map.has(id)).map((id) => map.get(id)!);
  const rest = accounts.filter((a) => !order.includes(a.id));
  return [...ordered, ...rest];
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
  const [loading, setLoading]     = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const dragSrc = useRef<string | null>(null);

  useEffect(() => {
    setAcctOrder(loadAcctOrder());
    Promise.allSettled([
      api.accounts.list(),
      api.budgets.list(month),
      api.points.summary(),
      api.transactions.list({ month, page_size: 6, include_pending: false }),
      api.transactions.spendByCategory(month),
    ]).then(([accountsRes, budgetsRes, pointsRes, txRes, spendRes]) => {
      if (accountsRes.status === "fulfilled") setAccts(accountsRes.value);
      if (budgetsRes.status  === "fulfilled") setBdgts(budgetsRes.value);
      if (pointsRes.status   === "fulfilled") setPts(pointsRes.value);
      if (txRes.status       === "fulfilled") setRecentTx(txRes.value.items);
      if (spendRes.status    === "fulfilled") setSpendData(spendRes.value);
      if (accountsRes.status === "rejected" || budgetsRes.status === "rejected") {
        setCriticalError("Some data failed to load. Check your connection or try refreshing.");
      }
      setLoading(false);
    });
  }, [month]);

  const sortedAccts = applyOrder(accts, acctOrder);
  const creditCards   = sortedAccts.filter((a) => a.type === "credit");
  const bankAccts     = sortedAccts.filter((a) => a.type !== "credit");
  const totalAssets   = bankAccts.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const totalDebt     = creditCards.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const netCash       = totalAssets - totalDebt;
  const pointsValue   = pts?.total_estimated_value_dollars ?? 0;
  const alerts        = pts?.programs.filter((p) => p.above_threshold) ?? [];
  const noAccounts    = !loading && accts.length === 0;

  // Drag handlers for account reordering
  function handleDragStart(id: string) { dragSrc.current = id; }
  function handleDrop(targetId: string) {
    if (!dragSrc.current || dragSrc.current === targetId) return;
    const ids = sortedAccts.map((a) => a.id);
    const from = ids.indexOf(dragSrc.current);
    const to   = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragSrc.current);
    dragSrc.current = null;
    setAcctOrder(ids);
    saveAcctOrder(ids);
  }

  const spendItems = spendData.slice(0, 7);
  const maxSpend   = Math.max(...spendItems.map((b) => b.spend), 1);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Critical error banner ────────────────────────────────────── */}
      {criticalError && (
        <div className="glass-card-expense flex items-center gap-3 p-4 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-semantic-expense flex-shrink-0" />
          <p className="text-[13px] text-semantic-expense">{criticalError}</p>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto hive-btn-ghost text-[12px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Action buttons row ───────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2">
        {alerts.length > 0 && (
          <Link
            href="/points"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-honey/[0.08] border border-honey/20
                       text-[12px] font-semibold text-honey
                       hover:bg-honey/[0.14] transition-all duration-150"
          >
            <Bell className="w-3 h-3" />
            {alerts.length} reward{alerts.length > 1 ? "s" : ""} ready
          </Link>
        )}
        <Link
          href="/connect"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     bg-elevated border border-white/[0.07]
                     text-[12px] font-medium text-ink-secondary
                     hover:text-ink-primary hover:bg-white/[0.06]
                     transition-all duration-150"
        >
          <Link2 className="w-3 h-3" />
          {noAccounts ? "Connect account" : "Add account"}
        </Link>
      </div>

      {/* ── PageHero ─────────────────────────────────────────────────── */}
      <PageHero
        eyebrow={`Dashboard · ${currentMonthLabel}`}
        headline={
          <>
            <span className="text-honey">{fmt(netCash)}</span>
          </>
        }
        subtext="net cash position this month"
        glowColor="honey"
        statStrip={[
          {
            label: "Total Assets",
            value: fmt(totalAssets),
            color: "green",
          },
          {
            label: "Credit Used",
            value: fmt(totalDebt),
            color: "red",
          },
          {
            label: "Points Value",
            value: pts ? fmt(pointsValue) : "—",
            color: "amber",
          },
          {
            label: currentMonthLabel,
            value: `${bdgts.length} budget${bdgts.length !== 1 ? "s" : ""}`,
            color: "default",
          },
        ]}
      />

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {noAccounts && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
          {/* Honeycomb hex icon */}
          <div className="w-20 h-20 rounded-3xl bg-honey/[0.10] border border-honey/20 flex items-center justify-center mb-6">
            <svg viewBox="0 0 40 46" className="w-10 h-10 fill-honey opacity-80" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0L40 11.5V34.5L20 46L0 34.5V11.5L20 0Z"/>
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold text-ink-primary mb-2">Welcome to Hive</h2>
          <p className="text-[14px] text-ink-secondary text-center max-w-sm mb-8">
            Connect your bank accounts and credit cards to see your complete financial picture in one place.
          </p>
          <a href="/connect" className="hive-btn-primary px-6 py-2.5 text-[14px] mb-10">
            Connect Accounts
          </a>
          {/* Feature bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
            {[
              { icon: "💳", title: "Track Spending", desc: "See every transaction, auto-categorized" },
              { icon: "⭐", title: "Optimize Rewards", desc: "Know which card earns the most on every purchase" },
              { icon: "🤖", title: "Ask AI", desc: "Chat with your finances in plain language" },
            ].map(f => (
              <div key={f.title} className="glass-card p-4 text-center">
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="text-[13px] font-semibold text-ink-primary mb-1">{f.title}</p>
                <p className="text-[12px] text-ink-tertiary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Tiles ───────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
              <div className="h-2 bg-white/[0.06] rounded-full w-16" />
              <div className="h-7 bg-white/[0.08] rounded-lg w-24" />
              <div className="h-2 bg-white/[0.04] rounded-full w-20" />
            </div>
          ))}
        </div>
      )}
      {!noAccounts && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label="Net Cash"
            value={fmt(netCash)}
            sub={netCash >= 0 ? "assets minus liabilities" : "net negative"}
            icon={netCash >= 0 ? TrendingUp : TrendingDown}
            tint={netCash >= 0 ? "income" : "expense"}
          />
          <KpiTile
            label="Total Assets"
            value={fmt(totalAssets)}
            sub={`${bankAccts.length} bank account${bankAccts.length !== 1 ? "s" : ""}`}
            icon={Landmark}
            tint="income"
          />
          <KpiTile
            label="Credit Balances"
            value={fmt(totalDebt)}
            sub={`across ${creditCards.length} card${creditCards.length !== 1 ? "s" : ""}`}
            icon={CreditCard}
            tint="expense"
          />
          <KpiTile
            label="Points Value"
            value={pts ? fmt(pointsValue) : "—"}
            sub="estimated · 90-day earned"
            icon={Gem}
            tint="amber"
          />
        </div>
      )}

      {/* ── Accounts + Spending ─────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 hive-card overflow-hidden">
            <div className="hive-section-header">
              <h2 className="hive-label">Accounts</h2>
            </div>
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 bg-white/[0.08] rounded w-32" />
                    <div className="h-2 bg-white/[0.04] rounded w-20" />
                  </div>
                  <div className="h-4 bg-white/[0.06] rounded w-16" />
                </div>
              ))}
            </div>
          </div>
          <div className="hive-card overflow-hidden">
            <div className="hive-section-header">
              <h2 className="hive-label">Spend by Category</h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-1.5 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-2.5 bg-white/[0.06] rounded w-24" />
                    <div className="h-2.5 bg-white/[0.04] rounded w-12" />
                  </div>
                  <div className="h-[2px] bg-white/[0.04] rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {!noAccounts && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Accounts — 2/3 */}
          <div className="lg:col-span-2 hive-card overflow-hidden">
            <div className="hive-section-header">
              <h2 className="hive-label">Accounts</h2>
              <Link href="/connect" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
                Manage <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Bank Accounts */}
            {bankAccts.length > 0 && (
              <div className="p-3 pb-0">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <Landmark className="w-3 h-3 text-semantic-income/60" />
                  <span className="text-[10px] font-semibold tracking-[0.10em] uppercase text-ink-tertiary">Accounts</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {bankAccts.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      isCredit={false}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Credit Cards */}
            {creditCards.length > 0 && (
              <div className="p-3">
                <div className={`flex items-center gap-2 px-1 mb-2 ${bankAccts.length > 0 ? "mt-1" : ""}`}>
                  <CreditCard className="w-3 h-3 text-honey/60" />
                  <span className="text-[10px] font-semibold tracking-[0.10em] uppercase text-ink-tertiary">Credit Cards</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {creditCards.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      isCredit={true}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spending by Category — 1/3 */}
          <div className="hive-card overflow-hidden flex flex-col">
            <div className="hive-section-header">
              <h2 className="hive-label">Spend by Category</h2>
              <span className="text-[11px] font-mono text-ink-tertiary">
                {monthLabel(month).split(" ")[0]}
              </span>
            </div>
            <div className="flex-1 px-5 py-4 space-y-2.5">
              {spendItems.length === 0 ? (
                <p className="text-[12px] text-ink-tertiary text-center py-6">
                  No spend data for {monthLabel(month)}
                </p>
              ) : (
                spendItems.map((b) => (
                  <div key={b.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-ink-secondary truncate pr-2">{b.category}</span>
                      <span className="text-[11px] font-mono text-ink-tertiary shrink-0">{fmt(b.spend)}</span>
                    </div>
                    <div className="h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${CAT_BAR[b.category] ?? "bg-ink-tertiary"}`}
                        style={{ width: `${(b.spend / maxSpend) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 pb-4">
              <Link
                href="/transactions"
                className="hive-btn-secondary w-full text-[12px] py-2"
              >
                All transactions
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Budgets ─────────────────────────────────────────────────── */}
      <div className="hive-card overflow-hidden">
        <div className="hive-section-header">
          <div>
            <h2 className="hive-label">Budgets</h2>
          </div>
          <Link href="/budgets" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
            Manage <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {bdgts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-ink-secondary mb-1">No budgets set</p>
            <p className="text-[12px] text-ink-tertiary mb-4">
              Set monthly spending limits to track your progress.
            </p>
            <Link href="/budgets" className="text-[13px] text-honey/80 hover:text-honey transition-colors">
              Create budgets →
            </Link>
          </div>
        ) : (
          <div className="px-5 divide-y divide-white/[0.04]">
            {bdgts.map((b, i) => (
              <BudgetRow
                key={b.id}
                category={b.category}
                actual={b.actual_spend}
                budget={b.budget_amount}
                pct={b.pct_used}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Transactions + Points ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Recent Transactions */}
        <div className="hive-card overflow-hidden">
          <div className="hive-section-header">
            <h2 className="hive-label">Recent Transactions</h2>
            <Link href="/transactions" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentTx.length === 0 ? (
              <p className="px-5 py-10 text-[12px] text-ink-tertiary text-center">
                No transactions for {monthLabel(month)}
              </p>
            ) : (
              recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 bg-elevated`}>
                    <span className="text-[10px]">
                      {tx.category?.charAt(0) ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink-primary font-medium truncate">
                      {tx.merchant ?? tx.raw_description}
                    </p>
                    <p className="text-[11px] text-ink-tertiary font-mono">{fmtDate(tx.date)}</p>
                  </div>
                  <p className={`text-[13px] font-mono font-medium shrink-0 tabular-nums ${
                    tx.amount < 0 ? "text-semantic-income" : "text-ink-primary"
                  }`}>
                    {tx.amount < 0 ? "+" : ""}
                    {fmt(Math.abs(tx.amount))}
                  </p>
                </div>
              ))
            )}
          </div>
          {recentTx.length > 0 && (
            <div className="px-4 py-3 hive-divider">
              <Link href="/transactions" className="hive-btn-secondary w-full text-[12px] py-2">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Points Programs */}
        <div className="hive-card overflow-hidden">
          <div className="hive-section-header">
            <h2 className="hive-label">Points Programs</h2>
            <Link href="/points" className="flex items-center gap-1 text-[12px] text-honey/80 hover:text-honey transition-colors">
              Details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {!pts || pts.programs.length === 0 ? (
            <p className="px-5 py-10 text-[12px] text-ink-tertiary text-center">
              No points data available
            </p>
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
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-mono font-semibold text-semantic-income tabular-nums">
                      ≈ {fmt(p.estimated_value_dollars)}
                    </p>
                  </div>
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
    </div>
  );
}
