"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  ProjectionResponse,
  PlanEvent,
  Goal,
  GoalProjection,
  TrimRecommendation,
  ForecastResponse,
} from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from "recharts";
import { ChartTooltip } from "@/components/ChartTooltip";
import {
  TrendingUp,
  Plus,
  Trash2,
  Loader2,
  Target,
  Scissors,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { toast } from "@/components/Toast";

type Tab = "projection" | "goals" | "trim" | "forecast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Projection Tab ────────────────────────────────────────────────────────────

function ProjectionTab() {
  const [data, setData]         = useState<ProjectionResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate]   = useState("");
  const [newCat, setNewCat]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.plan.projection(24)
      .then(setData)
      .catch(() => toast.error("Failed to load projection"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddEvent() {
    if (!newName || !newAmount || !newDate) return;
    setSaving(true);
    try {
      await api.plan.createEvent({
        name: newName,
        amount: parseFloat(newAmount),
        event_date: newDate,
        category: newCat || null,
        notes: null,
      });
      setNewName(""); setNewAmount(""); setNewDate(""); setNewCat("");
      setShowForm(false);
      load();
      toast.success("Event added to projection");
    } catch {
      toast.error("Failed to add event");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEvent(ev: PlanEvent) {
    try {
      await api.plan.updateEvent(ev.id, { is_active: !ev.is_active });
      load();
    } catch {
      toast.error("Failed to update event");
    }
  }

  async function handleDeleteEvent(id: string) {
    setDeletingId(id);
    try {
      await api.plan.deleteEvent(id);
      load();
      toast.success("Event removed");
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-tertiary gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading projection…</span>
      </div>
    );
  }

  if (!data) return null;

  // Merge historical + projected for the chart
  const chartData = [
    ...data.historical.map(p => ({ date: p.date, historical: p.net_worth, projected: null as number | null })),
    // Bridge: last historical point also appears as first projected
    ...(data.projected.length > 0 && data.historical.length > 0
      ? [{ date: data.historical[data.historical.length - 1].date,
           historical: null as number | null,
           projected: data.historical[data.historical.length - 1].net_worth }]
      : []),
    ...data.projected.map(p => ({ date: p.date, historical: null as number | null, projected: p.net_worth })),
  ];

  // Downsample to ~36 points for readability
  const step = Math.max(1, Math.floor(chartData.length / 36));
  const displayData = chartData.filter((_, i) => i % step === 0);

  return (
    <div className="space-y-5">
      {/* Summary stat */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Avg Monthly Savings",
            value: fmt(data.monthly_savings_avg),
            color: data.monthly_savings_avg >= 0 ? "text-semantic-income" : "text-semantic-expense",
          },
          {
            label: "Planned Expenses",
            value: fmt(data.events.filter(e => e.is_active).reduce((s, e) => s + e.amount, 0)),
            color: "text-semantic-expense",
          },
          {
            label: "Active Events",
            value: String(data.events.filter(e => e.is_active).length),
            color: "text-ink-primary",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="hive-card p-4">
            <p className="hive-label mb-2">{label}</p>
            <p className={cn("text-[20px] font-semibold font-mono tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Projection chart */}
      <div className="hive-card p-5">
        <p className="text-[13px] font-medium text-ink-primary mb-1">Net Worth Trajectory</p>
        <p className="text-[11px] text-ink-tertiary mb-4">Historical (solid) + 24-month projection (dashed)</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={displayData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#32D583" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#32D583" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5B942" stopOpacity={0.20} />
                <stop offset="95%" stopColor="#F5B942" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6B6B73", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#6B6B73", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="historical"
              stroke="#32D583"
              strokeWidth={2}
              fill="url(#histGrad)"
              dot={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#F5B942"
              strokeWidth={2}
              strokeDasharray="5 3"
              fill="url(#projGrad)"
              dot={false}
              connectNulls={false}
            />
            {/* Event markers */}
            {data.events
              .filter(e => e.is_active)
              .map(ev => (
                <ReferenceLine
                  key={ev.id}
                  x={ev.event_date}
                  stroke="rgba(249,112,102,0.6)"
                  strokeDasharray="3 3"
                  label={{ value: ev.name, position: "top", fill: "#F97066", fontSize: 10 }}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Events list */}
      <div className="hive-card overflow-hidden">
        <div className="hive-section-header">
          <p className="text-[13px] font-medium text-ink-primary">Planned Major Expenses</p>
          <button
            onClick={() => setShowForm(v => !v)}
            className="hive-btn-ghost flex items-center gap-1.5 text-[12px] text-honey"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-white/[0.04] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hive-label block mb-1">Event Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New car, vacation…"
                  className="hive-input"
                />
              </div>
              <div>
                <label className="hive-label block mb-1">Amount</label>
                <input
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  type="number"
                  placeholder="35000"
                  className="hive-input"
                />
              </div>
              <div>
                <label className="hive-label block mb-1">Date</label>
                <input
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  type="date"
                  className="hive-input"
                />
              </div>
              <div>
                <label className="hive-label block mb-1">Category</label>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  className="hive-select w-full"
                >
                  <option value="">— optional —</option>
                  {["Housing", "Vehicle", "Travel", "Education", "Medical", "Investment", "Other"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddEvent}
                disabled={saving || !newName || !newAmount || !newDate}
                className="hive-btn-primary text-[12px] px-4 py-2 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Add Event"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-[12px] px-4 py-2 rounded-lg hover:bg-white/[0.05] text-ink-tertiary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {data.events.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-ink-tertiary">
            No planned expenses yet. Add events to see their impact on your trajectory.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.events.map(ev => (
              <div key={ev.id} className="flex items-center gap-4 px-5 py-3">
                <input
                  type="checkbox"
                  checked={ev.is_active}
                  onChange={() => handleToggleEvent(ev)}
                  className="accent-honey w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-medium", ev.is_active ? "text-ink-primary" : "text-ink-tertiary line-through")}>
                    {ev.name}
                  </p>
                  <p className="text-[11px] text-ink-tertiary">
                    {fmtFullDate(ev.event_date)}{ev.category ? ` · ${ev.category}` : ""}
                  </p>
                </div>
                <p className="text-[13px] font-mono font-semibold text-semantic-expense tabular-nums shrink-0">
                  −{fmt(ev.amount)}
                </p>
                <button
                  onClick={() => handleDeleteEvent(ev.id)}
                  disabled={deletingId === ev.id}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-ink-tertiary hover:text-semantic-expense transition-colors disabled:opacity-40"
                >
                  {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Goals Tab ─────────────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Record<string, string> = {
  savings: "Savings Target",
  debt_payoff: "Debt Payoff",
  net_worth: "Net Worth Milestone",
  spend_limit: "Spending Limit",
};

function GoalsTab() {
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [projections, setProjections] = useState<Record<string, GoalProjection>>({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newType, setNewType]   = useState<"save" | "spend_under" | "pay_down">("save");
  const [newTarget, setNewTarget] = useState("");
  const [newDate, setNewDate]   = useState("");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const gs = await api.goals.list();
      setGoals(gs);
      // Load projections in parallel
      const projs = await Promise.all(gs.map(g => api.goals.projection(g.id).catch(() => null)));
      const projMap: Record<string, GoalProjection> = {};
      gs.forEach((g, i) => { if (projs[i]) projMap[g.id] = projs[i]!; });
      setProjections(projMap);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddGoal() {
    if (!newName || !newTarget) return;
    setSaving(true);
    try {
      await api.goals.create({
        name: newName,
        goal_type: newType,
        target_amount: parseFloat(newTarget),
        current_amount: 0,
        deadline: newDate || undefined,
      });
      setNewName(""); setNewType("save"); setNewTarget(""); setNewDate("");
      setShowForm(false);
      load();
      toast.success("Goal created");
    } catch {
      toast.error("Failed to create goal");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-ink-tertiary gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-[13px]">Loading goals…</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-tertiary">{goals.filter(g => !g.archived).length} active goals</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="hive-btn-ghost flex items-center gap-1.5 text-[12px] text-honey"
        >
          <Plus className="w-3.5 h-3.5" /> Add Goal
        </button>
      </div>

      {showForm && (
        <div className="hive-card p-5 space-y-3">
          <p className="text-[13px] font-medium text-ink-primary">New Goal</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="hive-label block mb-1">Goal Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="House down payment, emergency fund…"
                className="hive-input"
              />
            </div>
            <div>
              <label className="hive-label block mb-1">Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as "save" | "spend_under" | "pay_down")}
                className="hive-select w-full"
              >
                {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="hive-label block mb-1">Target Amount</label>
              <input
                value={newTarget}
                onChange={e => setNewTarget(e.target.value)}
                type="number"
                placeholder="50000"
                className="hive-input"
              />
            </div>
            <div>
              <label className="hive-label block mb-1">Target Date (optional)</label>
              <input
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                type="date"
                className="hive-input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddGoal}
              disabled={saving || !newName || !newTarget}
              className="hive-btn-primary text-[12px] px-4 py-2 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Create Goal"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[12px] px-4 py-2 rounded-lg hover:bg-white/[0.05] text-ink-tertiary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {goals.filter(g => !g.archived).length === 0 && !showForm && (
        <div className="hive-card py-12 text-center">
          <Target className="w-8 h-8 text-ink-tertiary/40 mx-auto mb-3" />
          <p className="text-[13px] text-ink-tertiary">No goals yet. Add one to start planning.</p>
        </div>
      )}

      {goals.filter(g => !g.archived).map(goal => {
        const proj = projections[goal.id];
        const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
        return (
          <div key={goal.id} className="hive-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-ink-primary">{goal.name}</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">
                  {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                  {goal.deadline ? ` · Target: ${fmtDate(goal.deadline)}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[18px] font-bold font-mono text-ink-primary tabular-nums">
                  {fmt(goal.current_amount)}
                </p>
                <p className="text-[11px] text-ink-tertiary">of {fmt(goal.target_amount)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] text-ink-tertiary mb-1">
                <span>{pct.toFixed(1)}% complete</span>
                <span>{fmt(goal.target_amount - goal.current_amount)} remaining</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? "#32D583" : pct >= 40 ? "#F5B942" : "#F97066",
                  }}
                />
              </div>
            </div>

            {/* Projection data */}
            {proj && (
              <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] px-4 py-3 space-y-1">
                {proj.projected_completion_date && (
                  <p className="text-[12px] text-ink-secondary">
                    At your current savings rate of{" "}
                    <span className="text-semantic-income font-semibold">{fmt(proj.monthly_savings_avg)}/mo</span>,
                    you&apos;ll reach this goal by{" "}
                    <span className={cn("font-semibold", proj.on_track ? "text-semantic-income" : "text-semantic-expense")}>
                      {fmtDate(proj.projected_completion_date)}
                    </span>
                    {!proj.on_track && goal.deadline && " (behind target)"}.
                  </p>
                )}
                {proj.required_monthly_to_hit_target !== null && !proj.on_track && (
                  <p className="text-[12px] text-ink-tertiary">
                    You need{" "}
                    <span className="text-honey font-semibold">{fmt(proj.required_monthly_to_hit_target)}/mo</span>
                    {" "}to hit your target date
                    {proj.monthly_savings_avg > 0
                      ? ` — ${fmt(proj.required_monthly_to_hit_target - proj.monthly_savings_avg)}/mo more than current pace.`
                      : "."}
                  </p>
                )}
                {proj.on_track && (
                  <p className="text-[12px] text-semantic-income flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> On track to hit your target.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Trim the Fat Tab ──────────────────────────────────────────────────────────

function TrimTab() {
  const [recs, setRecs]         = useState<TrimRecommendation[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [error, setError]       = useState(false);

  async function loadRecs() {
    setLoading(true);
    setError(false);
    try {
      const r = await api.plan.trimRecommendations();
      setRecs(r);
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetBudget(rec: TrimRecommendation) {
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    try {
      await api.budgets.upsert(rec.category, month, rec.suggested_monthly);
      toast.success(`Budget set to ${fmt(rec.suggested_monthly)}/mo for ${rec.category}`);
    } catch {
      toast.error("Failed to set budget");
    }
  }

  const totalSavings = recs.reduce((s, r) => s + r.savings_per_month, 0);

  return (
    <div className="space-y-5">
      {!loaded && !loading && (
        <div className="hive-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-honey/10 flex items-center justify-center">
            <Scissors className="w-6 h-6 text-honey" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-ink-primary">Analyze Your Budget</p>
            <p className="text-[12px] text-ink-tertiary mt-1 max-w-sm">
              Claude will analyze your last 3 months of spending and your goals to find the highest-leverage cuts.
            </p>
          </div>
          <button
            onClick={loadRecs}
            className="hive-btn-primary text-[13px] px-5 py-2.5"
          >
            Analyze Spending
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-ink-tertiary gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Claude is analyzing your spending…</span>
        </div>
      )}

      {error && (
        <div className="hive-card p-6 text-center">
          <p className="text-[13px] text-semantic-expense mb-3">Analysis failed. Check backend logs.</p>
          <button onClick={loadRecs} className="text-[12px] text-honey hover:underline">Try again</button>
        </div>
      )}

      {loaded && recs.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-ink-primary">Budget Optimization Opportunities</p>
              <p className="text-[11px] text-ink-tertiary mt-0.5">
                {recs.length} recommendations · {fmt(totalSavings)}/mo potential savings
              </p>
            </div>
            <button onClick={loadRecs} className="text-[11px] text-honey hover:underline">Re-analyze</button>
          </div>

          <div className="space-y-3">
            {recs.map((rec, i) => (
              <div key={i} className="hive-card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink-primary">
                      {rec.category}{rec.subcategory ? ` · ${rec.subcategory}` : ""}
                    </p>
                    <p className="text-[12px] text-ink-tertiary mt-0.5">{rec.rationale}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[18px] font-bold font-mono text-semantic-income tabular-nums">
                      +{fmt(rec.savings_per_month)}/mo
                    </p>
                    <p className="text-[10px] text-ink-tertiary">savings</p>
                  </div>
                </div>

                {/* Current vs suggested */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-1.5 rounded-full bg-semantic-expense/30 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-semantic-expense"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <span className="text-[11px] text-ink-tertiary tabular-nums shrink-0">
                    {fmt(rec.current_monthly)} → {fmt(rec.suggested_monthly)}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-semantic-income/30 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-semantic-income"
                      style={{ width: `${(rec.suggested_monthly / rec.current_monthly) * 100}%` }}
                    />
                  </div>
                </div>

                {rec.goal_impact && (
                  <p className="text-[11px] text-honey mb-3">🎯 {rec.goal_impact}</p>
                )}

                <button
                  onClick={() => handleSetBudget(rec)}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-ink-secondary hover:text-ink-primary transition-colors flex items-center gap-1.5"
                >
                  <Target className="w-3 h-3" />
                  Set as budget ({fmt(rec.suggested_monthly)}/mo)
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {loaded && recs.length === 0 && (
        <div className="hive-card py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-semantic-income mx-auto mb-3" />
          <p className="text-[13px] text-ink-secondary font-medium">Your spending looks well-optimized!</p>
          <p className="text-[12px] text-ink-tertiary mt-1">No significant cuts identified based on your goals.</p>
        </div>
      )}
    </div>
  );
}

// ── Forecast Tab ─────────────────────────────────────────────────────────────

const FORECAST_CATEGORIES = [
  "Food & Drink", "Groceries", "Travel", "Transportation", "Entertainment",
  "Shopping", "Health", "Utilities", "Home", "Education", "Personal Care", "Business",
];

function ForecastTab() {
  const [category, setCategory] = useState("Food & Drink");
  const [periods, setPeriods]   = useState(30);
  const [data, setData]         = useState<ForecastResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async (cat: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.forecast.category(cat, p);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Forecast failed — need at least 30 days of history");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(category, periods); }, [category, periods, load]);

  const chartData = data?.daily_forecast.map((d) => ({
    date: d.date.slice(5),   // MM-DD
    predicted: Math.max(0, d.predicted),
    lower: Math.max(0, d.lower),
    upper: Math.max(0, d.upper),
    band: [Math.max(0, d.lower), Math.max(0, d.upper)] as [number, number],
  })) ?? [];

  // Running cumulative for the projected total
  let cumulative = 0;
  const cumulativeData = (data?.daily_forecast ?? []).map((d) => {
    cumulative += Math.max(0, d.predicted);
    return { date: d.date.slice(5), cumulative };
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="hive-card p-4 flex items-center gap-4 flex-wrap">
        <div>
          <p className="hive-label mb-1.5">Category</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="hive-select"
          >
            {FORECAST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <p className="hive-label mb-1.5">Forecast horizon</p>
          <div className="flex gap-1">
            {([30, 60, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriods(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                  periods === p
                    ? "bg-white/[0.08] text-ink-primary"
                    : "text-ink-tertiary hover:text-ink-secondary"
                )}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        {data && (
          <div className="ml-auto text-right">
            <p className="hive-label mb-1">Projected total ({periods}d)</p>
            <p className="text-[20px] font-extrabold font-mono text-honey tabular-nums">
              {fmt(data.projected_total)}
            </p>
            <p className="text-[10px] text-ink-tertiary">{data.history_days} days of history used</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="hive-card p-10 flex items-center justify-center gap-2 text-ink-tertiary text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Running Prophet model…
        </div>
      )}

      {error && !loading && (
        <div className="hive-card p-6 text-center">
          <p className="text-[13px] text-ink-tertiary">{error}</p>
          <p className="text-[11px] text-ink-ghost mt-1">Prophet needs at least 30 days of transaction history for this category.</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Daily forecast with confidence band */}
          <div className="hive-card p-5">
            <p className="text-[12px] font-medium text-ink-secondary mb-4">
              Daily forecast — {category} · confidence interval
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.floor(chartData.length / 6)}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v.toFixed(0)}`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,20,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.8)",
                  }}
                  formatter={(v: number, name: string) => [
                    `$${v.toFixed(2)}`,
                    name === "predicted" ? "Predicted" : name === "lower" ? "Lower bound" : "Upper bound",
                  ]}
                  cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                {/* Confidence band as two areas */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  fill="rgba(201,146,14,0.12)"
                  stroke="none"
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  fill="rgba(15,15,20,1)"
                  stroke="none"
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="rgba(201,146,14,0.9)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#3B82F6" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative projected spend */}
          <div className="hive-card p-5">
            <p className="text-[12px] font-medium text-ink-secondary mb-4">
              Cumulative projected spend over {periods} days
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={cumulativeData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.floor(cumulativeData.length / 6)}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,20,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.8)",
                  }}
                  formatter={(v: number) => [fmt(v), "Cumulative"]}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="rgba(56,189,248,0.8)"
                  strokeWidth={2}
                  fill="rgba(56,189,248,0.08)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [tab, setTab] = useState<Tab>("projection");

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "projection", label: "Projection",    icon: TrendingUp },
    { id: "goals",      label: "Goals",         icon: Target     },
    { id: "trim",       label: "Trim the Fat",  icon: Scissors   },
    { id: "forecast",   label: "Forecast",      icon: Activity   },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHero
        eyebrow="Financial Planning"
        headline={<><span className="text-semantic-income">Plan</span> your future</>}
        subtext="Project your trajectory, set goals, trim the fat"
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-elevated rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium transition-all",
              tab === id
                ? "bg-white/[0.08] text-ink-primary shadow-sm"
                : "text-ink-tertiary hover:text-ink-secondary"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "projection" && <ProjectionTab />}
      {tab === "goals"      && <GoalsTab />}
      {tab === "trim"       && <TrimTab />}
      {tab === "forecast"   && <ForecastTab />}
    </div>
  );
}
