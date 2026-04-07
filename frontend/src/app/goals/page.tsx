"use client";

import { useEffect, useState } from "react";
import { api, type Goal } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Target, TrendingUp, Calendar, CheckCircle2, Plus, Loader2, X } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GlassCard } from "@/components/GlassCard";

// Returns gradient color by goal type
function goalGradient(type: string): string {
  switch (type) {
    case "savings":    return "linear-gradient(90deg, #34D399, #10B981)";
    case "debt":       return "linear-gradient(90deg, #F87171, #EF4444)";
    case "purchase":   return "linear-gradient(90deg, #F5B942, #FFD166)";
    case "investment": return "linear-gradient(90deg, #38BDF8, #0EA5E9)";
    default:           return "linear-gradient(90deg, #34D399, #10B981)";
  }
}

// Icon per goal type
function GoalIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "debt":       return <TrendingUp className={cn("w-4 h-4", className)} />;
    case "purchase":   return <Target className={cn("w-4 h-4", className)} />;
    case "investment": return <TrendingUp className={cn("w-4 h-4", className)} />;
    default:           return <Target className={cn("w-4 h-4", className)} />;
  }
}

// Accent color class per goal type
function goalAccentClass(type: string): string {
  switch (type) {
    case "savings":    return "text-semantic-income";
    case "debt":       return "text-semantic-expense";
    case "purchase":   return "text-honey";
    case "investment": return "text-[#38BDF8]";
    default:           return "text-semantic-income";
  }
}

// Tint for GlassCard per goal type
function goalTint(type: string): "none" | "income" | "expense" | "amber" | "sky" | "violet" {
  switch (type) {
    case "savings":    return "income";
    case "debt":       return "expense";
    case "purchase":   return "amber";
    case "investment": return "sky";
    default:           return "none";
  }
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal_type: "savings",
    target_amount: "",
    current_amount: "",
    target_date: "",
  });

  useEffect(() => {
    api.goals
      .list(false)
      .then(setGoals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.target_amount) return;
    setSaving(true);
    try {
      const goal = await api.goals.create({
        name: form.name.trim(),
        goal_type: form.goal_type,
        target_amount: parseFloat(form.target_amount),
        current_amount: form.current_amount ? parseFloat(form.current_amount) : undefined,
        target_date: form.target_date || undefined,
      });
      setGoals((prev) => [...prev, goal]);
      setShowAdd(false);
      setForm({ name: "", goal_type: "savings", target_amount: "", current_amount: "", target_date: "" });
    } catch {
      // error stays silent for now — form remains open
    } finally {
      setSaving(false);
    }
  }

  const activeGoals = goals.filter((g) => !g.is_completed && !g.is_archived);
  const completedGoals = goals.filter((g) => g.is_completed);
  const onTrackCount = activeGoals.filter((g) => g.on_track === true).length;
  const behindCount = activeGoals.filter((g) => g.on_track === false).length;
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* PageHero */}
      <PageHero
        eyebrow="Financial Goals"
        headline={
          <><span className="text-semantic-income">{activeGoals.length}</span> goals</>
        }
        subtext="your savings and debt progress"
        glowColor="emerald"
        statStrip={[
          { label: "On Track",     value: String(onTrackCount),  color: "green" },
          { label: "Behind",       value: String(behindCount),   color: "red" },
          { label: "Total Target", value: fmt(totalTarget),       color: "default" },
        ]}
      />

      {/* Loading / error states */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-tertiary text-[13px]">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading goals…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-[13px] text-semantic-expense">{error}</div>
      )}

      {/* Active goals */}
      {!loading && !error && activeGoals.length === 0 && (
        <GlassCard className="p-10 flex flex-col items-center gap-3 text-center">
          <Target className="w-8 h-8 text-ink-ghost" />
          <p className="text-[14px] font-medium text-ink-secondary">No active goals yet</p>
          <p className="text-[12px] text-ink-tertiary max-w-xs">
            Create savings, debt payoff, or investment goals to track your progress here.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-honey/[0.12] border border-honey/25 text-honey text-[12px] font-semibold hover:bg-honey/[0.18] transition-colors"
          >
            <Plus size={13} />
            Add Goal
          </button>
        </GlassCard>
      )}

      {!loading && !error && activeGoals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">Active</p>
            <button
              onClick={() => setShowAdd(true)}
              className="hive-btn-secondary flex items-center gap-1.5 text-[12px] py-1 px-3"
            >
              <Plus size={13} />
              Add Goal
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeGoals.map((goal, index) => {
              const accentCls = goalAccentClass(goal.goal_type);
              const gradient  = goalGradient(goal.goal_type);
              const tint      = goalTint(goal.goal_type);
              const pct       = Math.min(Math.max(goal.pct_complete, 0), 100);

              return (
                <GlassCard key={goal.id} tint={tint} className="p-5 space-y-4">
                  {/* Goal header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("p-1.5 rounded-lg bg-white/[0.05]", accentCls)}>
                        <GoalIcon type={goal.goal_type} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ink-primary truncate">{goal.name}</p>
                        {goal.description && (
                          <p className="text-[11px] text-ink-tertiary truncate mt-0.5">{goal.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-[16px] font-bold font-mono tabular-nums", accentCls)}>
                        {pct.toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-ink-ghost">complete</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <AnimatedBar
                    pct={pct}
                    color={gradient}
                    height={6}
                    delay={index * 80}
                  />

                  {/* Amounts row */}
                  <div className="flex items-center justify-between text-[12px]">
                    <div>
                      <span className="text-ink-tertiary">Saved </span>
                      <span className={cn("font-semibold font-mono tabular-nums", accentCls)}>
                        {fmt(goal.current_amount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-ink-tertiary">Goal </span>
                      <span className="font-semibold font-mono tabular-nums text-ink-secondary">
                        {fmt(goal.target_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Footer: target date + on-track badge */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                    {goal.target_date ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
                        <Calendar size={11} />
                        <span>Target: {fmtDate(goal.target_date)}</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    {goal.on_track !== null && (
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                        goal.on_track
                          ? "bg-semantic-income/10 text-semantic-income"
                          : "bg-semantic-expense/10 text-semantic-expense"
                      )}>
                        {goal.on_track ? "On Track" : "Behind"}
                      </span>
                    )}
                  </div>

                  {/* Monthly contribution hint */}
                  {goal.required_monthly_contribution !== null && goal.required_monthly_contribution > 0 && (
                    <p className="text-[11px] text-ink-tertiary">
                      {fmt(goal.required_monthly_contribution)}/mo needed to reach goal
                    </p>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {!loading && !error && completedGoals.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider px-0.5">Completed</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {completedGoals.map((goal, index) => {
              const gradient = goalGradient(goal.goal_type);
              return (
                <GlassCard key={goal.id} className="p-5 space-y-3 opacity-70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-white/[0.05] text-semantic-income">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ink-secondary truncate">{goal.name}</p>
                        {goal.completed_at && (
                          <p className="text-[11px] text-ink-tertiary mt-0.5">
                            Completed {fmtDate(goal.completed_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[14px] font-bold font-mono tabular-nums text-semantic-income">
                        {fmt(goal.target_amount)}
                      </p>
                    </div>
                  </div>
                  <AnimatedBar
                    pct={100}
                    color={gradient}
                    height={4}
                    delay={index * 60}
                  />
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-ink-primary">New Goal</h2>
              <button onClick={() => setShowAdd(false)} className="hive-btn-ghost p-1">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Name */}
              <div>
                <label className="hive-label">Goal Name</label>
                <input
                  className="hive-input"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Emergency Fund"
                  required
                />
              </div>
              {/* Type */}
              <div>
                <label className="hive-label">Goal Type</label>
                <select
                  className="hive-select w-full"
                  value={form.goal_type}
                  onChange={(e) => setForm((p) => ({ ...p, goal_type: e.target.value }))}
                >
                  <option value="savings">Savings</option>
                  <option value="debt">Debt Payoff</option>
                  <option value="purchase">Purchase</option>
                  <option value="investment">Investment</option>
                </select>
              </div>
              {/* Target Amount */}
              <div>
                <label className="hive-label">Target Amount</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="hive-input"
                  value={form.target_amount}
                  onChange={(e) => setForm((p) => ({ ...p, target_amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              {/* Current Amount */}
              <div>
                <label className="hive-label">Current Amount (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="hive-input"
                  value={form.current_amount}
                  onChange={(e) => setForm((p) => ({ ...p, current_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              {/* Target Date */}
              <div>
                <label className="hive-label">Target Date (optional)</label>
                <input
                  type="date"
                  className="hive-input"
                  value={form.target_date}
                  onChange={(e) => setForm((p) => ({ ...p, target_date: e.target.value }))}
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="hive-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="hive-btn-primary flex-1"
                >
                  {saving ? "Saving…" : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
