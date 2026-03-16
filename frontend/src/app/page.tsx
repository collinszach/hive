import { api } from "@/lib/api";
import { fmt, currentMonth, monthLabel, CARD_NAMES } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function BudgetBar({ category, actual, budget, pct }: {
  category: string; actual: number; budget: number; pct: number;
}) {
  const color = pct > 100 ? "bg-red-500" : pct > 80 ? "bg-yellow-400" : "bg-emerald-500";
  const barPct = Math.min(pct, 100);
  return (
    <div className="py-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{category}</span>
        <span className="text-gray-400">{fmt(actual)} / {fmt(budget)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${barPct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{pct.toFixed(0)}% used</p>
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
  const alerts = pts?.programs.filter((p) => p.above_threshold) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{monthLabel(month)}</p>
        </div>
        <Link href="/connect" className="text-sm text-indigo-400 hover:text-indigo-300">
          + Connect account
        </Link>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-900/20 p-4">
          <p className="text-sm font-semibold text-yellow-300">Points ready to redeem</p>
          <ul className="mt-1 space-y-0.5">
            {alerts.map((a) => (
              <li key={a.program} className="text-sm text-yellow-200">
                {a.program}: {(a.manual_balance ?? Math.round(a.points_earned_90d)).toLocaleString()} pts ≈ {fmt(a.estimated_value_dollars)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Balances</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Bank Assets" value={fmt(totalAssets)} />
          <StatCard label="Credit Balances" value={fmt(totalDebt)} />
          {creditCards.map((a) => (
            <StatCard
              key={a.id}
              label={CARD_NAMES[a.card_slug ?? ""] ?? a.name}
              value={fmt(a.current_balance ?? 0)}
              sub={a.credit_limit ? `of ${fmt(a.credit_limit)} limit` : undefined}
            />
          ))}
          {bankAccounts.map((a) => (
            <StatCard key={a.id} label={a.name} value={fmt(a.current_balance ?? 0)} sub={a.institution} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Budgets — {monthLabel(month)}
          </h2>
          <Link href="/budgets" className="text-xs text-indigo-400 hover:text-indigo-300">Manage →</Link>
        </div>
        {bdgts.length === 0 ? (
          <p className="text-sm text-gray-500">
            No budgets set.{" "}
            <Link href="/budgets" className="text-indigo-400 hover:text-indigo-300">Create one →</Link>
          </p>
        ) : (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 divide-y divide-gray-800">
            {bdgts.map((b) => (
              <BudgetBar key={b.id} category={b.category} actual={b.actual_spend} budget={b.budget_amount} pct={b.pct_used} />
            ))}
          </div>
        )}
      </section>

      {pts && pts.programs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Points (90d)</h2>
            <Link href="/points" className="text-xs text-indigo-400 hover:text-indigo-300">Details →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {pts.programs.map((p) => (
              <div key={p.program} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
                <p className="text-xs text-gray-500 truncate">{p.program}</p>
                <p className="text-lg font-bold mt-1">{Math.round(p.points_earned_90d).toLocaleString()}</p>
                <p className="text-xs text-emerald-400">≈ {fmt(p.estimated_value_dollars)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">Total estimated value: {fmt(pts.total_estimated_value_dollars)}</p>
        </section>
      )}

      <section className="flex gap-3 flex-wrap">
        <Link href="/transactions" className="rounded-lg bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm transition-colors">
          View transactions →
        </Link>
        <Link href="/optimize" className="rounded-lg bg-indigo-700 hover:bg-indigo-600 px-4 py-2 text-sm transition-colors">
          Card optimizer →
        </Link>
      </section>
    </div>
  );
}
