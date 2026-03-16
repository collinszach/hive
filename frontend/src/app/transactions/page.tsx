"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Transaction } from "@/lib/api";
import { fmt, fmtDate, currentMonth, CATEGORY_COLORS, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";

function CategoryBadge({ category }: { category: string | null }) {
  const cls = CATEGORY_COLORS[category ?? ""] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {category ?? "—"}
    </span>
  );
}

function CategoryEditor({
  tx,
  onSave,
}: {
  tx: Transaction;
  onSave: (id: string, cat: string, sub: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(tx.category ?? "");
  const [sub, setSub] = useState(tx.subcategory ?? "");
  const [saving, setSaving] = useState(false);

  const subs = SUBCATEGORIES[cat] ?? [];

  async function save() {
    if (!cat || !sub) return;
    setSaving(true);
    try {
      await api.transactions.updateCategory(tx.id, cat, sub);
      onSave(tx.id, cat, sub);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-left hover:opacity-80">
        <CategoryBadge category={tx.category} />
        {tx.subcategory && (
          <span className="ml-1 text-xs text-gray-500">{tx.subcategory}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex gap-1 items-center flex-wrap">
      <select
        value={cat}
        onChange={(e) => { setCat(e.target.value); setSub(""); }}
        className="text-xs bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-white"
      >
        <option value="">Category</option>
        {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={sub}
        onChange={(e) => setSub(e.target.value)}
        className="text-xs bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-white"
      >
        <option value="">Subcategory</option>
        {subs.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button
        onClick={save}
        disabled={!cat || !sub || saving}
        className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-2 py-0.5 rounded text-white"
      >
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300">✕</button>
    </div>
  );
}

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [includePending, setIncludePending] = useState(false);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [data, setData] = useState<{ items: Transaction[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.transactions.list({
        month,
        search: search || undefined,
        category: category || undefined,
        include_pending: includePending,
        include_excluded: includeExcluded,
        page,
        page_size: 50,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [month, search, category, page, includePending, includeExcluded]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(id: string, cat: string, sub: string) {
    setData((prev) => prev
      ? { ...prev, items: prev.items.map((t) => t.id === id ? { ...t, category: cat, subcategory: sub, category_source: "manual" } : t) }
      : prev
    );
  }

  // Generate month options (current + 11 prior)
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="">All categories</option>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <input
          type="search"
          placeholder="Search merchant..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 min-w-[200px]"
        />

        <label className="flex items-center gap-1.5 text-sm text-gray-400">
          <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} className="rounded" />
          Pending
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-400">
          <input type="checkbox" checked={includeExcluded} onChange={(e) => setIncludeExcluded(e.target.checked)} className="rounded" />
          Excluded
        </label>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-xs text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Merchant</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {loading && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">Loading…</td></tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">No transactions found</td></tr>
            )}
            {!loading && data?.items.map((tx) => (
              <tr
                key={tx.id}
                className={cn(
                  "hover:bg-gray-900/50",
                  tx.is_excluded && "opacity-40",
                  tx.pending && "italic text-gray-500"
                )}
              >
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{fmtDate(tx.date)}</td>
                <td className="px-4 py-2 max-w-[240px]">
                  <div className="flex items-center gap-2">
                    {tx.logo_url && (
                      <img src={tx.logo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    )}
                    <span className="truncate">{tx.merchant ?? tx.raw_description}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <CategoryEditor tx={tx} onSave={handleSaved} />
                </td>
                <td className={cn(
                  "px-4 py-2 text-right font-mono whitespace-nowrap",
                  tx.amount < 0 ? "text-emerald-400" : "text-white"
                )}>
                  {tx.amount < 0 ? `+${fmt(Math.abs(tx.amount))}` : fmt(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{data.total} transactions</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-gray-400">
              {page} / {data.pages}
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
