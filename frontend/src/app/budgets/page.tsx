"use client";

import { useState, useEffect } from "react";
import { api, Budget } from "@/lib/api";
import { fmt, currentMonth, monthLabel, ALL_CATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";

function BudgetRow({ b, onUpdate }: { b: Budget; onUpdate: (b: Budget) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(b.budget_amount));
  const [saving, setSaving] = useState(false);

  const color = b.pct_used > 100 ? "bg-red-500" : b.pct_used > 80 ? "bg-yellow-400" : "bg-emerald-500";
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
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="font-medium">{b.category}</span>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">$</span>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-white"
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
            />
            <button onClick={save} disabled={saving} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-white disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500">✕</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
            Edit
          </button>
        )}
      </div>

      <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${barPct}%` }} />
      </div>

      <div className="flex justify-between text-sm">
        <span className={cn(
          "font-semibold",
          b.pct_used > 100 ? "text-red-400" : b.pct_used > 80 ? "text-yellow-400" : "text-emerald-400"
        )}>
          {b.pct_used.toFixed(0)}% used
        </span>
        <span className="text-gray-400">
          {fmt(b.actual_spend)} / {fmt(b.budget_amount)}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">
        {b.remaining >= 0 ? `${fmt(b.remaining)} remaining` : `${fmt(Math.abs(b.remaining))} over budget`}
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
        return exists ? prev.map((x) => x.id === b.id ? b : x) : [...prev, b].sort((a, c) => a.category.localeCompare(c.category));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <p className="text-sm text-gray-500">{monthLabel(month)}</p>

      {/* Add new budget */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-900 border border-gray-800 rounded-xl">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Category</label>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">Select category</option>
            {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Monthly Budget ($)</label>
          <input
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="500"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-28"
            onKeyDown={(e) => e.key === "Enter" && addBudget()}
          />
        </div>
        <button
          onClick={addBudget}
          disabled={adding || !newCategory || !newAmount}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm text-white"
        >
          {adding ? "Adding…" : "Add Budget"}
        </button>
      </div>

      {/* Budget grid */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : budgets.length === 0 ? (
        <p className="text-gray-500 text-sm">No budgets for {monthLabel(month)}. Add one above.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => (
            <BudgetRow key={b.id} b={b} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
