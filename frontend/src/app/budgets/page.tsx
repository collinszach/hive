"use client";

import { useState, useEffect } from "react";
import { api, Budget } from "@/lib/api";
import { fmt, currentMonth, monthLabel, ALL_CATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

function BudgetRow({ b, onUpdate }: { b: Budget; onUpdate: (b: Budget) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(b.budget_amount));
  const [saving, setSaving] = useState(false);

  const isOver = b.pct_used > 100;
  const isWarning = b.pct_used > 80 && !isOver;
  const barColor = isOver ? "bg-rose-500" : isWarning ? "bg-amber-400" : "bg-emerald-500";
  const statusColor = isOver ? "text-rose-400" : isWarning ? "text-amber-400" : "text-emerald-400";
  const barPct = Math.min(b.pct_used, 100);

  async function save() {
    const amt = parseFloat(value);
    if (isNaN(amt) || amt < 0) return;
    setSaving(true);
    try {
      const monthStr = b.month.substring(0, 7);
      const updated = await api.budgets.upsert(b.category, monthStr, amt);
      onUpdate(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-slate-200">{b.category}</span>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">$</span>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
            />
            <button
              onClick={save}
              disabled={saving}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 rounded-lg text-white disabled:opacity-50 transition-colors"
            >
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300 px-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-semibold tabular-nums", statusColor)}>
          {b.pct_used.toFixed(0)}% used
        </span>
        <span className="text-slate-500 tabular-nums">
          {fmt(b.actual_spend)} / {fmt(b.budget_amount)}
        </span>
      </div>
      <p className="text-xs text-slate-600 mt-1 tabular-nums">
        {b.remaining >= 0
          ? `${fmt(b.remaining)} remaining`
          : `${fmt(Math.abs(b.remaining))} over budget`}
      </p>
    </div>
  );
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [adding, setAdding] = useState(false);

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

  async function addBudget() {
    const amt = parseFloat(newAmount);
    if (!newCategory || isNaN(amt) || amt <= 0) return;
    setAdding(true);
    try {
      const b = await api.budgets.upsert(newCategory, month, amt);
      setBudgets((prev) => {
        const exists = prev.find((x) => x.id === b.id);
        return exists
          ? prev.map((x) => x.id === b.id ? b : x)
          : [...prev, b].sort((a, c) => a.category.localeCompare(c.category));
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

  const existingCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = ALL_CATEGORIES.filter((c) => !existingCategories.has(c));

  const totalBudgeted = budgets.reduce((s, b) => s + b.budget_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.actual_spend, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Budgets</h1>
          <p className="text-sm text-slate-500 mt-0.5">{monthLabel(month)}</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Summary bar */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Total Budgeted</p>
            <p className="text-lg font-bold text-white tabular-nums">{fmt(totalBudgeted)}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Total Spent</p>
            <p className="text-lg font-bold text-white tabular-nums">{fmt(totalSpent)}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Remaining</p>
            <p className={`text-lg font-bold tabular-nums ${totalBudgeted - totalSpent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {fmt(totalBudgeted - totalSpent)}
            </p>
          </div>
        </div>
      )}

      {/* Add new budget */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Add Budget</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select category</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Monthly Budget ($)</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="500"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white w-28 focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && addBudget()}
            />
          </div>
          <button
            onClick={addBudget}
            disabled={adding || !newCategory || !newAmount}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {adding ? "Adding…" : "Add Budget"}
          </button>
        </div>
      </div>

      {/* Budget grid */}
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl bg-slate-900 border border-slate-800 border-dashed p-12 text-center">
          <p className="text-slate-500 text-sm">No budgets for {monthLabel(month)}.</p>
          <p className="text-slate-600 text-xs mt-1">Add one above to start tracking your spending.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {budgets.map((b) => (
            <BudgetRow key={b.id} b={b} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
