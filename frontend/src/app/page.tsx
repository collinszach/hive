import { api } from "@/lib/api";
import { fmt, currentMonth, monthLabel, CARD_NAMES } from "@/lib/utils";
import Link from "next/link";
import {
  Landmark,
  CreditCard,
  Gem,
  Bell,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Zap,
} from "lucide-react";

export const revalidate = 60;

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  accentClass,
  iconClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  accentClass: string;
  iconClass: string;
}) {
  return (
    <div className={`rounded-xl bg-slate-900 border border-slate-800 p-5 border-l-[3px] ${accentClass}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconClass} bg-opacity-15`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      )}
    </div>
  );
}

function BudgetRow({ category, actual, budget, pct }: {
  category: string; actual: number; budget: number; pct: number;
}) {
  const barColor = pct > 100 ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500";
  const textColor = pct > 100 ? "text-rose-400" : pct > 80 ? "text-amber-400" : "text-emerald-400";
  const barPct = Math.min(pct, 100);
  return (
    <div className="py-3">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-slate-300">{category}</span>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{pct.toFixed(0)}%</span>
          <span className="text-xs text-slate-500 tabular-nums">{fmt(actual)} / {fmt(budget)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const month = currentMonth();

  const [accounts, budgets, pointsSummary] = await Promise.allSettled([
    api.accounts.list(),
    api.budgets.list(month),
    api.points.summary(),
  ]);

  const accts = accounts.status === "fulfilled" ? accounts.value : [];
  const bdgts = budgets.status === "fulfilled" ? budgets.value : [];
  const pts = pointsSummary.status === "fulfilled" ? pointsSummary.value : null;

  const creditCards = accts.filter((a) => a.type === "credit");
  const bankAccounts = accts.filter((a) => a.type !== "credit");
  const totalAssets = bankAccounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const totalDebt = creditCards.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const netCash = totalAssets - totalDebt;
  const alerts = pts?.programs.filter((p) => p.above_threshold) ?? [];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{monthLabel(month)}</p>
        </div>
        <Link
          href="/connect"
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Connect account
        </Link>
      </div>

      {/* Redemption alert */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">Points ready to redeem</p>
          </div>
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li key={a.program} className="flex items-center justify-between text-sm">
                <span className="text-amber-200">{a.program}</span>
                <span className="text-amber-300 font-medium tabular-nums">
                  {(a.manual_balance ?? Math.round(a.points_earned_90d)).toLocaleString()} pts ≈ {fmt(a.estimated_value_dollars)}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/points" className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
            View points <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* KPI row */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Bank Assets"
            value={fmt(totalAssets)}
            icon={Landmark}
            accentClass="border-l-emerald-500"
            iconClass="text-emerald-400 bg-emerald-500/10"
            sub={`${bankAccounts.length} account${bankAccounts.length !== 1 ? "s" : ""}`}
          />
          <KpiCard
            label="Credit Balances"
            value={fmt(totalDebt)}
            icon={CreditCard}
            accentClass="border-l-rose-500"
            iconClass="text-rose-400 bg-rose-500/10"
            sub={`${creditCards.length} card${creditCards.length !== 1 ? "s" : ""}`}
          />
          <KpiCard
            label="Net Cash"
            value={fmt(netCash)}
            icon={netCash >= 0 ? TrendingUp : TrendingDown}
            accentClass={netCash >= 0 ? "border-l-indigo-500" : "border-l-rose-500"}
            iconClass={netCash >= 0 ? "text-indigo-400 bg-indigo-500/10" : "text-rose-400 bg-rose-500/10"}
            sub="assets minus credit"
          />
          <KpiCard
            label="Points Value"
            value={pts ? fmt(pts.total_estimated_value_dollars) : "—"}
            icon={Gem}
            accentClass="border-l-violet-500"
            iconClass="text-violet-400 bg-violet-500/10"
            sub="estimated (90d earned)"
          />
        </div>
      </section>

      {/* Account cards */}
      {accts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Accounts</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {creditCards.map((a) => (
              <div key={a.id} className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 truncate mb-1">{CARD_NAMES[a.card_slug ?? ""] ?? a.name}</p>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(a.current_balance ?? 0)}</p>
                {a.credit_limit && (
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">of {fmt(a.credit_limit)}</p>
                )}
              </div>
            ))}
            {bankAccounts.map((a) => (
              <div key={a.id} className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 truncate mb-1">{a.name}</p>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(a.current_balance ?? 0)}</p>
                {a.institution && <p className="text-xs text-slate-600 mt-0.5">{a.institution}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Budgets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Budgets — {monthLabel(month)}
          </h2>
          <Link href="/budgets" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Manage <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {bdgts.length === 0 ? (
          <div className="rounded-xl bg-slate-900 border border-slate-800 border-dashed p-8 text-center">
            <p className="text-sm text-slate-500 mb-2">No budgets set for this month.</p>
            <Link href="/budgets" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Create your first budget →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-5 divide-y divide-slate-800/60">
            {bdgts.map((b) => (
              <BudgetRow
                key={b.id}
                category={b.category}
                actual={b.actual_spend}
                budget={b.budget_amount}
                pct={b.pct_used}
              />
            ))}
          </div>
        )}
      </section>

      {/* Points mini-grid */}
      {pts && pts.programs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Points (90-day)</h2>
            <Link href="/points" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {pts.programs.map((p) => (
              <div key={p.program} className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-3">
                <p className="text-xs text-slate-500 truncate leading-tight">{p.program}</p>
                <p className="text-base font-bold mt-1.5 tabular-nums">
                  {Math.round(p.points_earned_90d).toLocaleString()}
                </p>
                <p className="text-xs text-emerald-400 tabular-nums">≈ {fmt(p.estimated_value_dollars)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="flex gap-2.5 flex-wrap">
        <Link
          href="/transactions"
          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors"
        >
          View transactions <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/optimize"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm text-white font-medium transition-colors"
        >
          Card optimizer <Zap className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/net-worth"
          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors"
        >
          Net worth <TrendingUp className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  );
}
