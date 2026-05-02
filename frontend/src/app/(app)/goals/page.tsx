"use client";

import { useEffect, useState } from "react";
import { api, type Goal, type GoalCreate, type GoalUpdate, type GoalType, type GoalProjection } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";
import { Pencil, Star, Archive, Plus, X, Target, PlusCircle, Loader2, ExternalLink } from "lucide-react";
import { useRef } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  save:        "Save up",
  spend_under: "Spend under",
  pay_down:    "Pay down",
};

interface FormState {
  name: string;
  goal_type: GoalType;
  target_amount: string;
  current_amount: string;
  category: string;
  deadline: string;
  pinned: boolean;
}

const EMPTY_FORM: FormState = {
  name: "", goal_type: "save", target_amount: "", current_amount: "",
  category: "", deadline: "", pinned: false,
};

function formFromGoal(g: Goal): FormState {
  return {
    name: g.name, goal_type: g.goal_type,
    target_amount: String(g.target_amount), current_amount: String(g.current_amount),
    category: g.category ?? "", deadline: g.deadline ?? "", pinned: g.pinned,
  };
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal, projection, onEdit, onPin, onArchive, onContribute,
}: {
  goal: Goal;
  projection?: GoalProjection;
  onEdit: (g: Goal) => void;
  onPin: (g: Goal) => void;
  onArchive: (g: Goal) => void;
  onContribute: (g: Goal, amount: number) => Promise<void>;
}) {
  const pct    = Math.min(Math.max(goal.pct_complete, 0), 100);
  const isOver = goal.pct_complete > 100;
  const [contributing, setContributing] = useState(false);
  const [contribValue, setContribValue] = useState("");
  const [contribSaving, setContribSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function openContrib() {
    setContribValue("");
    setContribSaving(false);
    setContributing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function submitContrib(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(contribValue);
    if (isNaN(amt) || amt === 0) return;
    setContribSaving(true);
    try {
      await onContribute(goal, amt);
      setContributing(false);
      setContribValue("");
    } finally {
      setContribSaving(false);
    }
  }

  return (
    <GlassCard className={cn("p-4 transition-opacity", goal.archived && "opacity-50")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-semibold text-ink-primary truncate">{goal.name}</span>
          {goal.pinned && <Star className="w-3 h-3 text-honey shrink-0" fill="currentColor" />}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {goal.on_track !== null && goal.deadline && goal.remaining > 0 && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
              goal.on_track
                ? "bg-semantic-income/[0.08] text-semantic-income border-semantic-income/20"
                : "bg-semantic-expense/[0.08] text-semantic-expense border-semantic-expense/20"
            )}>
              {goal.on_track ? "on track" : "behind"}
            </span>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.05] text-ink-tertiary border border-white/[0.06]">
            {GOAL_TYPE_LABELS[goal.goal_type]}
          </span>
        </div>
      </div>

      {/* Amounts */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-mono text-ink-tertiary tabular-nums">{fmt(goal.current_amount)}</span>
        <span className="text-[11px] text-ink-ghost">{goal.pct_complete.toFixed(0)}%</span>
        <span className="text-[12px] font-mono text-ink-tertiary tabular-nums">{fmt(goal.target_amount)}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOver ? "bg-semantic-expense" : "bg-semantic-income"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Bottom row: meta + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {goal.remaining > 0 && (
            <span className={cn(
              "text-[11px]",
              isOver ? "text-semantic-expense" : "text-ink-tertiary"
            )}>
              {fmt(goal.remaining)} remaining
            </span>
          )}
          {goal.deadline && (
            <span className="text-[11px] text-ink-ghost">
              · due {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              {goal.months_remaining && ` (${goal.months_remaining}mo)`}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {goal.goal_type === "save" && !goal.archived && goal.pct_complete < 100 && (
            <button
              onClick={openContrib}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-semantic-income bg-semantic-income/[0.07] border border-semantic-income/20 hover:bg-semantic-income/[0.12] transition-colors mr-1"
              title="Log contribution"
            >
              <PlusCircle className="w-3 h-3" />
              Log
            </button>
          )}
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 rounded-lg text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.05] transition-colors"
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onPin(goal)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              goal.pinned
                ? "text-honey hover:bg-honey/[0.08]"
                : "text-ink-ghost hover:text-honey hover:bg-white/[0.05]"
            )}
            title={goal.pinned ? "Unpin" : "Pin"}
          >
            <Star className="w-3 h-3" fill={goal.pinned ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onArchive(goal)}
            className="p-1.5 rounded-lg text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.05] transition-colors"
            title={goal.archived ? "Unarchive" : "Archive"}
          >
            <Archive className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Monthly target nudge */}
      {goal.monthly_target && goal.months_remaining && goal.remaining > 0 && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-honey/[0.05] border border-honey/[0.12] flex items-center justify-between">
          <span className="text-[11px] text-ink-tertiary">Transfer monthly to stay on track</span>
          <span className="text-[13px] font-mono font-bold text-honey tabular-nums">{fmt(goal.monthly_target)}/mo</span>
        </div>
      )}

      {/* View transactions link for spend_under goals */}
      {goal.goal_type === "spend_under" && goal.category && (
        <Link
          href={`/transactions?category=${encodeURIComponent(goal.category)}`}
          className="flex items-center gap-1 mt-2 text-[11px] text-ink-ghost hover:text-ink-secondary transition-colors no-underline w-fit"
        >
          <ExternalLink className="w-3 h-3" />
          View {goal.category} transactions
        </Link>
      )}

      {/* Projection strip */}
      {projection && goal.remaining > 0 && !goal.archived && (
        <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px]">
          {projection.projected_completion_date && (
            <span className="text-ink-ghost">
              Projected:{" "}
              <span className={cn(
                "font-medium",
                projection.on_track ? "text-semantic-income" : "text-semantic-expense"
              )}>
                {new Date(projection.projected_completion_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            </span>
          )}
          {projection.monthly_savings_avg > 0 && (
            <span className="text-ink-ghost">
              · saving ~{fmt(projection.monthly_savings_avg)}/mo
            </span>
          )}
          {!projection.on_track && projection.required_monthly_to_hit_target != null && (
            <span className="text-semantic-expense font-medium">
              · need {fmt(projection.required_monthly_to_hit_target)}/mo to hit deadline
            </span>
          )}
        </div>
      )}

      {/* Contribution form */}
      {contributing && (
        <form
          onSubmit={submitContrib}
          className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-semantic-income/[0.05] border border-semantic-income/20"
        >
          <span className="text-[11px] text-ink-tertiary whitespace-nowrap">Log contribution</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-ghost">$</span>
            <input
              ref={inputRef}
              type="number"
              min="0.01"
              step="0.01"
              value={contribValue}
              onChange={(e) => setContribValue(e.target.value)}
              placeholder="0.00"
              className="w-full pl-5 pr-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-semantic-income/40 tabular-nums"
            />
          </div>
          <button
            type="submit"
            disabled={contribSaving || !contribValue}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-semantic-income text-white disabled:opacity-50 hover:bg-semantic-income/90 transition-colors shrink-0"
          >
            {contribSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setContributing(false)}
            className="p-1.5 rounded-md text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </GlassCard>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function GoalModal({
  editing, onClose, onSave,
}: {
  editing: Goal | null;
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
}) {
  const [form, setForm]     = useState<FormState>(editing ? formFromGoal(editing) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40 transition-colors";
  const labelCls = "block text-[11px] text-ink-tertiary mb-1.5";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto bg-[#0F1014] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[15px] font-semibold text-ink-primary">
            {editing ? "Edit Goal" : "New Goal"}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              type="text"
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Emergency Fund"
              required
            />
          </div>

          <div>
            <label className={labelCls}>Goal Type</label>
            <select
              className={inputCls}
              value={form.goal_type}
              onChange={(e) => setForm(p => ({ ...p, goal_type: e.target.value as GoalType }))}
            >
              <option value="save">Save up</option>
              <option value="spend_under">Spend under</option>
              <option value="pay_down">Pay down</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Target Amount</label>
              <input
                type="number" min="0" step="1"
                className={inputCls}
                value={form.target_amount}
                onChange={(e) => setForm(p => ({ ...p, target_amount: e.target.value }))}
                placeholder="5000"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Current Amount</label>
              <input
                type="number" min="0" step="1"
                className={inputCls}
                value={form.current_amount}
                onChange={(e) => setForm(p => ({ ...p, current_amount: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Category (optional)</label>
            <input
              type="text"
              className={inputCls}
              value={form.category}
              onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
              placeholder="e.g. Travel"
            />
          </div>

          <div>
            <label className={labelCls}>Deadline (optional)</label>
            <input
              type="date"
              className={cn(inputCls, "[color-scheme:dark]")}
              value={form.deadline}
              onChange={(e) => setForm(p => ({ ...p, deadline: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm(p => ({ ...p, pinned: e.target.checked }))}
              className="w-3.5 h-3.5 accent-honey"
            />
            <span className="text-[12px] text-ink-secondary">Pin this goal</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-[13px] font-medium rounded-lg border border-white/[0.08] text-ink-secondary hover:text-ink-primary hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-[13px] font-semibold rounded-lg bg-honey text-black hover:bg-honey/90 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals]               = useState<Goal[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [projections, setProjections]   = useState<Record<number, GoalProjection>>({});
  const [modal, setModal]               = useState<{ open: boolean; editing: Goal | null }>({
    open: false, editing: null,
  });

  useEffect(() => {
    setLoading(true);
    api.goals.list(showArchived)
      .then((loaded) => {
        setGoals(loaded);
        // Fetch projections in parallel for active, incomplete goals
        const targets = loaded.filter(g => !g.archived && g.pct_complete < 100);
        Promise.allSettled(targets.map(g => api.goals.projection(g.id))).then((results) => {
          const map: Record<number, GoalProjection> = {};
          results.forEach((r, i) => {
            if (r.status === "fulfilled") map[targets[i].id] = r.value;
          });
          setProjections(map);
        });
      })
      .catch(() => { toast.error("Failed to load goals"); setGoals([]); })
      .finally(() => setLoading(false));
  }, [showArchived]);

  async function handleSave(form: FormState) {
    const target  = parseFloat(form.target_amount);
    const current = form.current_amount ? parseFloat(form.current_amount) : undefined;
    if (isNaN(target)) return;

    try {
      if (modal.editing) {
        const body: GoalUpdate = {
          name: form.name.trim(), goal_type: form.goal_type,
          target_amount: target, current_amount: current,
          category: form.category || null, deadline: form.deadline || null, pinned: form.pinned,
        };
        const updated = await api.goals.update(modal.editing.id, body);
        setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
        toast.success("Goal updated");
      } else {
        const body: GoalCreate = {
          name: form.name.trim(), goal_type: form.goal_type,
          target_amount: target, current_amount: current,
          category: form.category || null, deadline: form.deadline || null, pinned: form.pinned,
        };
        const created = await api.goals.create(body);
        setGoals(prev => [...prev, created]);
        toast.success("Goal created");
      }
      setModal({ open: false, editing: null });
    } catch {
      toast.error(modal.editing ? "Failed to update goal" : "Failed to create goal");
    }
  }

  async function handlePin(g: Goal) {
    try {
      const updated = await api.goals.update(g.id, { pinned: !g.pinned });
      setGoals(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch {
      toast.error("Failed to update goal");
    }
  }

  async function handleArchive(g: Goal) {
    try {
      const updated = await api.goals.update(g.id, { archived: !g.archived });
      setGoals(prev => prev.map(x => x.id === updated.id ? updated : x));
      toast.success(g.archived ? "Goal unarchived" : "Goal archived");
    } catch {
      toast.error("Failed to archive goal");
    }
  }

  async function handleContribute(g: Goal, amount: number) {
    try {
      const updated = await api.goals.contribute(g.id, amount);
      setGoals(prev => prev.map(x => x.id === updated.id ? updated : x));
      toast.success(`Logged $${amount.toFixed(2)} contribution`);
    } catch {
      toast.error("Failed to log contribution");
    }
  }

  const visibleGoals = goals
    .filter(g => showArchived || !g.archived)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.id - a.id;
    });

  const activeGoals = visibleGoals.filter(g => !g.archived);
  const completedGoals = activeGoals.filter(g => g.pct_complete >= 100);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow="Goals"
            headline={
              activeGoals.length > 0
                ? <><span className="text-honey">{activeGoals.length}</span> active</>
                : <span className="text-ink-secondary">No goals yet</span>
            }
            subtext="Track your financial targets and stay on course"
            glowColor="amber"
            statStrip={activeGoals.length > 0 ? [
              { label: "Active",    value: String(activeGoals.length),    color: "amber"   },
              { label: "Completed", value: String(completedGoals.length), color: "green"   },
              { label: "Pinned",    value: String(activeGoals.filter(g => g.pinned).length), color: "default" },
            ] : undefined}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => setShowArchived(v => !v)}
            className={cn(
              "hive-btn-secondary text-[12px] px-3 py-1.5",
              showArchived && "text-honey border-honey/30"
            )}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="hive-btn-primary text-[12px] px-3 py-1.5 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Goal
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <GlassCard key={i} className="p-4 h-24 animate-pulse">{null}</GlassCard>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && visibleGoals.length === 0 && (
        <GlassCard className="py-16 text-center">
          <Target className="w-10 h-10 text-ink-tertiary/20 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-secondary">No goals yet</p>
          <p className="text-[12px] text-ink-tertiary mt-1 mb-5">Create a goal to start tracking your progress.</p>
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="hive-btn-primary text-[12px] px-4 py-2 gap-1.5 inline-flex items-center"
          >
            <Plus className="w-3.5 h-3.5" />
            New Goal
          </button>
        </GlassCard>
      )}

      {/* Goal cards */}
      {!loading && visibleGoals.length > 0 && (
        <div className="space-y-3">
          {visibleGoals.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              projection={projections[g.id]}
              onEdit={goal => setModal({ open: true, editing: goal })}
              onPin={handlePin}
              onArchive={handleArchive}
              onContribute={handleContribute}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <GoalModal
          editing={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
