"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Transaction } from "@/lib/api";
import { fmt, fmtDate, currentMonth, CATEGORY_COLORS, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

function CategoryBadge({ category }: { category: string | null }) {
  const cls = CATEGORY_COLORS[category ?? ""] ?? "bg-slate-800 text-slate-400";
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
      <button onClick={() => setOpen(true)} className="text-left hover:opacity-80 group">
        <CategoryBadge category={tx.category} />
        {tx.subcategory && (
          <span className="ml-1.5 text-xs text-slate-500 group-hover:text-slate-400">{tx.subcategory}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex gap-1.5 items-center flex-wrap">
      <select
        value={cat}
        onChange={(e) => { setCat(e.target.value); setSub(""); }}
        className="text-xs bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
      >
        <option value="">Category</option>
        {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={sub}
        onChange={(e) => setSub(e.target.value)}
        className="text-xs bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
      >
        <option value="">Subcategory</option>
        {subs.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button
        onClick={save}
        disabled={!cat || !sub || saving}
        className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-2.5 py-1 rounded-md text-white transition-colors"
      >
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300 px-1">✕</button>
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

  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Transactions</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">{data.total.toLocaleString()} transactions</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <SlidersHorizontal className="w-4 h-4 text-slate-500 shrink-0" />

          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Search merchant..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-500 min-w-[200px] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            Pending
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeExcluded}
              onChange={(e) => setIncludeExcluded(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            Excluded
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Merchant</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-slate-950 divide-y divide-slate-800/50">
            {loading && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-slate-500">
                  <div className="inline-block animate-pulse">Loading transactions…</div>
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-slate-500">
                  No transactions found
                </td>
              </tr>
            )}
            {!loading && data?.items.map((tx) => (
              <tr
                key={tx.id}
                className={cn(
                  "hover:bg-slate-900/60 transition-colors",
                  tx.is_excluded && "opacity-40",
                  tx.pending && "italic"
                )}
              >
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs font-mono">
                  {fmtDate(tx.date)}
                </td>
                <td className="px-4 py-2.5 max-w-[240px]">
                  <div className="flex items-center gap-2">
                    {tx.logo_url && (
                      <img src={tx.logo_url} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
                    )}
                    <span className="truncate text-slate-200">{tx.merchant ?? tx.raw_description}</span>
                    {tx.pending && (
                      <span className="shrink-0 text-xs text-amber-500/70 font-normal not-italic">pending</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <CategoryEditor tx={tx} onSave={handleSaved} />
                </td>
                <td className={cn(
                  "px-4 py-2.5 text-right font-mono whitespace-nowrap font-medium",
                  tx.amount < 0 ? "text-emerald-400" : "text-slate-200"
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
          <span className="text-slate-500 text-xs">{data.total.toLocaleString()} transactions · page {page} of {data.pages}</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 rounded-lg text-slate-300 transition-colors text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 rounded-lg text-slate-300 transition-colors text-xs"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
