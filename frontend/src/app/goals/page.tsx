"use client";

import { useEffect, useState } from "react";
import { api, type Goal } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Target, TrendingUp, Calendar, CheckCircle2, Plus, Loader2 } from "lucide-react";
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

  useEffect(() => {
    api.goals
      .list(false)
      .then(setGoals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
          <button className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-honey/[0.12] border border-honey/25 text-honey text-[12px] font-semibold hover:bg-honey/[0.18] transition-colors">
            <Plus size={13} />
            Add Goal
          </button>
        </GlassCard>
      )}

      {!loading && !error && activeGoals.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider px-0.5">Active</p>
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
    </div>
  );
}
