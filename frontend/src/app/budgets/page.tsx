"use client";

import { useState, useEffect } from "react";
import { api, Budget } from "@/lib/api";
import { fmt, currentMonth, monthLabel, ALL_CATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, X } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GlassCard } from "@/components/GlassCard";

// ── Budget Card ────────────────────────────────────────────────────────────

function BudgetCard({
  b,
  index,
  onUpdate,
  onDelete,
}: {
  b: Budget;
  index: number;
  onUpdate: (b: Budget) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(b.budget_amount));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOver    = b.pct_used > 100;
  const isWarning = b.pct_used > 80 && !isOver;
  const barColor  = isOver
    ? "linear-gradient(90deg, #F87171, #EF4444)"
    : isWarning
    ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
    : "linear-gradient(90deg, #34D399, #10B981)";
  const pctColor  = isOver ? "text-semantic-expense" : isWarning ? "text-honey" : "text-semantic-income";
  const barPct    = Math.min(b.pct_used, 100);

  async function save() {
    const amt = parseFloat(value);
    if (isNaN(amt) || amt < 0) return;
    setSaving(true);
    try {
      const monthStr = b.month.substring(0, 7);
      const updated  = await api.budgets.upsert(b.category, monthStr, amt);
      onUpdate(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.budgets.delete(b.id);
      onDelete(b.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <GlassCard
      tint="none"
      className={cn(
        "p-5 transition-all duration-200",
        isOver && "border-semantic-expense/20",
        isWarning && "border-honey/20"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[14px] font-medium text-ink-primary">{b.category}</span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-ink-tertiary">$</span>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 bg-elevated border border-white/[0.1] rounded-lg px-2 py-1 text-[13px]
                         text-ink-primary focus:outline-none focus:border-honey/40"
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
            />
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 text-[11px] bg-honey/[0.12] border border-honey/20
                         text-honey px-2 py-1 rounded-lg hover:bg-honey/[0.2] disabled:opacity-40 transition-colors"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center justify-center w-6 h-6 rounded-lg text-ink-tertiary
                         hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-semantic-expense">Remove?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[11px] bg-semantic-expense/10 border border-semantic-expense/20
                         text-semantic-expense px-2.5 py-1 rounded-lg hover:bg-semantic-expense/20
                         disabled:opacity-40 transition-colors"
            >
              {deleting ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex items-center justify-center w-6 h-6 rounded-lg text-ink-tertiary
                         hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] text-honey/70 hover:text-honey transition-colors px-2 py-1 rounded-lg hover:bg-honey/[0.06]"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-tertiary/50
                         hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Animated progress bar */}
      <AnimatedBar
        pct={barPct}
        color={barColor}
        height={6}
        delay={index * 80}
        className="mb-4"
      />

      {/* Stats */}
      <div className="flex items-center justify-between">
        <span className={cn("text-[13px] font-semibold font-mono", pctColor)}>
          {b.pct_used.toFixed(0)}%
        </span>
        <span className="text-[12px] font-mono text-ink-tertiary tabular-nums">
          {fmt(b.actual_spend)} / {fmt(b.budget_amount)}
        </span>
      </div>
      <p className="text-[11px] text-ink-tertiary/60 mt-1 font-mono tabular-nums">
        {b.remaining >= 0
          ? `${fmt(b.remaining)} remaining`
          : `${fmt(Math.abs(b.remaining))} over budget`}
      </p>
    </GlassCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const [month, setMonth]           = useState(currentMonth());
  const [budgets, setBudgets]       = useState<Budget[]>([]);
  const [loading, setLoading]       = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount]   = useState("");
  const [adding, setAdding]         = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.budgets.list(month);
      setBudgets(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [month]);

  function handleUpdate(updated: Budget) {
    setBudgets((prev) => prev.map((b) => b.id === updated.id ? updated : b));
  }

  function handleDelete(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  async function addBudget() {
    const cat = newCategory.trim();
    const amt = parseFloat(newAmount);
    if (!cat || isNaN(amt) || amt <= 0) return;
    setAdding(true);
    try {
      const b = await api.budgets.upsert(cat, month, amt);
      setBudgets((prev) => {
        const exists = prev.find((x) => x.id === b.id);
        return exists
          ? prev.map((x) => x.id === b.id ? b : x)
          : [...prev, b].sort((a, c) => b.actual_spend > 0 ? -1 : a.category.localeCompare(c.category));
      });
      setNewCategory("");
      setNewAmount("");
    } finally {
      setAdding(false);
    }
  }

  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.budget_amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.actual_spend, 0);
  const remaining     = totalBudgeted - totalSpent;
  const onTrackCount  = budgets.filter((b) => b.pct_used <= 80).length;
  const currentMonthLabel = monthLabel(month);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── PageHero ────────────────────────────────────────────────── */}
      {budgets.length > 0 && (
        <PageHero
          eyebrow={`Budgets · ${currentMonthLabel}`}
          headline={
            <>
              <span className="text-semantic-income">{onTrackCount}</span>
              <span className="text-ink-tertiary text-[28px] font-semibold">/{budgets.length}</span>
            </>
          }
          subtext="budgets on track this month"
          glowColor="emerald"
          statStrip={[
            {
              label: "Total Budgeted",
              value: fmt(totalBudgeted),
              color: "default",
            },
            {
              label: "Total Spent",
              value: fmt(totalSpent),
              color: totalSpent > totalBudgeted ? "red" : "default",
            },
            {
              label: "Savings Available",
              value: fmt(Math.max(remaining, 0)),
              color: remaining >= 0 ? "green" : "red",
            },
          ]}
        />
      )}

      {/* ── Month Selector ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Budgets</h1>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="hive-select text-[13px] py-1.5 w-auto"
        >
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* ── Add Budget ──────────────────────────────────────────────── */}
      <div className="hive-card p-5">
        <p className="hive-label mb-4">Add Budget</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[11px] text-ink-tertiary mb-1.5 tracking-wide">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="hive-select w-48 text-[13px]"
            >
              <option value="">Select category…</option>
              {ALL_CATEGORIES.filter((c) => c !== "Transfers" && c !== "Uncategorized").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-ink-tertiary mb-1.5 tracking-wide">Monthly Budget ($)</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="500"
              className="bg-elevated border border-white/[0.08] rounded-xl px-3 py-2 text-[13px]
                         text-ink-primary w-28 focus:outline-none focus:border-honey/40 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && newCategory && addBudget()}
            />
          </div>
          <button
            onClick={addBudget}
            disabled={adding || !newCategory.trim() || !newAmount}
            className="hive-btn-primary py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            {adding ? "Adding…" : "Add Budget"}
          </button>
        </div>
      </div>

      {/* ── Budget Grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-ink-tertiary text-[13px] py-4">
          <div className="w-3 h-3 rounded-full border border-ink-tertiary/40 border-t-honey animate-spin" />
          Loading…
        </div>
      ) : budgets.length === 0 ? (
        <div className="hive-card p-16 text-center border-dashed">
          <p className="text-[14px] text-ink-secondary mb-1">No budgets for {monthLabel(month)}</p>
          <p className="text-[12px] text-ink-tertiary">Add one above to start tracking your spending.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {budgets.map((b, index) => (
            <BudgetCard key={b.id} b={b} index={index} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
