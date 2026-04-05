"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, Transaction } from "@/lib/api";
import { fmt, fmtDate, currentMonth } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Check, X, Pencil } from "lucide-react";

// ── Card Badge ─────────────────────────────────────────────────────────────

function CardBadge({ cardSlug, accountName }: { cardSlug: string | null; accountName: string | null }) {
  const label = accountName ?? cardSlug ?? "—";
  return (
    <span className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium
                     bg-white/[0.05] text-ink-tertiary border border-white/[0.07] whitespace-nowrap">
      {label}
    </span>
  );
}

// ── Category Badge ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  "Food & Drink":   "bg-orange-400/10 text-orange-300 border-orange-400/15",
  "Groceries":      "bg-emerald-400/10 text-emerald-300 border-emerald-400/15",
  "Travel":         "bg-sky-400/10 text-sky-300 border-sky-400/15",
  "Transportation": "bg-yellow-400/10 text-yellow-300 border-yellow-400/15",
  "Entertainment":  "bg-violet-400/10 text-violet-300 border-violet-400/15",
  "Shopping":       "bg-pink-400/10 text-pink-300 border-pink-400/15",
  "Health":         "bg-rose-400/10 text-rose-300 border-rose-400/15",
  "Utilities":      "bg-slate-400/10 text-slate-300 border-slate-400/15",
  "Home":           "bg-teal-400/10 text-teal-300 border-teal-400/15",
  "Education":      "bg-indigo-400/10 text-indigo-300 border-indigo-400/15",
  "Personal Care":  "bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/15",
  "Income":         "bg-emerald-400/10 text-emerald-300 border-emerald-400/15",
  "Transfers":      "bg-zinc-400/10 text-zinc-400 border-white/10",
  "Uncategorized":  "bg-zinc-400/10 text-zinc-400 border-white/10",
};

function CategoryBadge({ category }: { category: string | null }) {
  const cls = CAT_COLORS[category ?? ""] ?? "bg-white/[0.06] text-ink-tertiary border-white/10";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium border", cls)}>
      {category ?? "—"}
    </span>
  );
}

// ── Inline Merchant Editor ──────────────────────────────────────────────────

function MerchantCell({
  tx,
  onSave,
}: {
  tx: Transaction;
  onSave: (id: string, merchant: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tx.merchant ?? tx.raw_description);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (tx.merchant ?? tx.raw_description)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await api.transactions.patch(tx.id, { merchant: trimmed });
      onSave(tx.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(tx.merchant ?? tx.raw_description);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="text-[13px] bg-elevated border border-honey/30 rounded-lg px-2 py-0.5 text-ink-primary
                     focus:outline-none focus:border-honey/50 w-40"
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center justify-center w-5 h-5 rounded text-honey hover:bg-honey/[0.12] disabled:opacity-40 transition-colors"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={cancel}
          className="flex items-center justify-center w-5 h-5 rounded text-ink-tertiary hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left w-full"
    >
      {tx.logo_url && (
        <img src={tx.logo_url} alt="" className="h-5 w-5 rounded-full object-cover shrink-0 opacity-80" />
      )}
      <span className="text-[13px] text-ink-primary truncate">
        {tx.merchant ?? tx.raw_description}
      </span>
      <Pencil className="w-2.5 h-2.5 text-ink-tertiary/0 group-hover:text-ink-tertiary/50 transition-colors shrink-0" />
      {tx.pending && (
        <span className="shrink-0 text-[10px] text-honey/70 font-medium">pending</span>
      )}
    </button>
  );
}

// ── Inline Category Editor ──────────────────────────────────────────────────

function CategoryCell({
  tx,
  categories,
  onSave,
}: {
  tx: Transaction;
  categories: string[];
  onSave: (id: string, cat: string, sub: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cat, setCat] = useState(tx.category ?? "");
  const [sub, setSub] = useState(tx.subcategory ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!cat) return;
    setSaving(true);
    try {
      await api.transactions.patch(tx.id, { category: cat, subcategory: sub || undefined });
      onSave(tx.id, cat, sub);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setCat(tx.category ?? "");
    setSub(tx.subcategory ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="group flex items-center gap-1.5 text-left">
        <CategoryBadge category={tx.category} />
        {tx.subcategory && (
          <span className="text-[11px] text-ink-tertiary group-hover:text-ink-secondary transition-colors truncate max-w-[80px]">
            {tx.subcategory}
          </span>
        )}
        <Pencil className="w-2.5 h-2.5 text-ink-tertiary/0 group-hover:text-ink-tertiary/50 transition-colors shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <input
        list="cat-list"
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
        placeholder="Category"
        autoFocus
        className="text-[12px] bg-elevated border border-honey/30 rounded-lg px-2 py-1 text-ink-primary
                   w-32 focus:outline-none focus:border-honey/50"
      />
      <datalist id="cat-list">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <input
        value={sub}
        onChange={(e) => setSub(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
        placeholder="Subcategory"
        className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-2 py-1 text-ink-primary
                   w-28 focus:outline-none focus:border-honey/40"
      />
      <button
        onClick={save}
        disabled={!cat || saving}
        className="flex items-center gap-1 text-[11px] bg-honey/[0.12] border border-honey/20
                   text-honey px-2 py-1 rounded-lg hover:bg-honey/[0.2] disabled:opacity-40 transition-colors"
      >
        <Check className="w-3 h-3" />
        {saving ? "…" : "Save"}
      </button>
      <button
        onClick={cancel}
        className="flex items-center justify-center w-6 h-6 rounded-lg text-ink-tertiary hover:bg-white/[0.06] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [includePending, setIncludePending] = useState(false);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [data, setData] = useState<{ items: Transaction[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [txCategories, setTxCategories] = useState<string[]>([]);

  // Load category list for autocomplete + filter
  useEffect(() => {
    api.transactions.categories()
      .then((cats) => setTxCategories(cats.map((c) => c.category)))
      .catch(() => {});
  }, []);

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

  function handleMerchantSaved(id: string, merchant: string) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((t) => t.id === id ? { ...t, merchant } : t) } : prev
    );
  }

  function handleCategorySaved(id: string, cat: string, sub: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((t) =>
              t.id === id ? { ...t, category: cat, subcategory: sub, category_source: "manual" } : t
            ),
          }
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
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Transactions</h1>
        {data && (
          <p className="text-[13px] text-ink-tertiary mt-0.5">
            {data.total.toLocaleString()} transactions
          </p>
        )}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="hive-card p-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <SlidersHorizontal className="w-[15px] h-[15px] text-ink-tertiary shrink-0" />

          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1); }}
            className="hive-select text-[13px] py-1.5 w-auto"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Category filter — dynamic from real transaction data */}
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="hive-select text-[13px] py-1.5 w-auto"
          >
            <option value="">All categories</option>
            {txCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none" />
            <input
              type="search"
              placeholder="Search merchant…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-elevated border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-[13px]
                         text-ink-primary placeholder-ink-tertiary min-w-[200px]
                         focus:outline-none focus:border-honey/40 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="rounded accent-[#F5B942] w-3.5 h-3.5"
            />
            Pending
          </label>

          <label className="flex items-center gap-2 text-[13px] text-ink-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeExcluded}
              onChange={(e) => setIncludeExcluded(e.target.checked)}
              className="rounded accent-[#F5B942] w-3.5 h-3.5"
            />
            Excluded
          </label>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="hive-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.05]">
            <tr>
              <th className="px-5 py-3 text-left w-[90px]">
                <span className="hive-label">Date</span>
              </th>
              <th className="px-5 py-3 text-left">
                <span className="hive-label">Merchant</span>
              </th>
              <th className="px-5 py-3 text-left">
                <span className="hive-label">Category</span>
              </th>
              <th className="px-5 py-3 text-left w-[110px]">
                <span className="hive-label">Card</span>
              </th>
              <th className="px-5 py-3 text-right w-[110px]">
                <span className="hive-label">Amount</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={5} className="text-center py-16 text-ink-tertiary">
                  <div className="inline-block animate-pulse text-[13px]">Loading…</div>
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-16 text-[13px] text-ink-tertiary">
                  No transactions found
                </td>
              </tr>
            )}
            {!loading && data?.items.map((tx) => (
              <tr
                key={tx.id}
                className={cn(
                  "hover:bg-white/[0.02] transition-colors",
                  tx.is_excluded && "opacity-35",
                  tx.pending && "opacity-60"
                )}
              >
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className="text-[12px] font-mono text-ink-tertiary">{fmtDate(tx.date)}</span>
                </td>
                <td className="px-5 py-3 max-w-[260px]">
                  <MerchantCell tx={tx} onSave={handleMerchantSaved} />
                </td>
                <td className="px-5 py-3 min-w-[200px]">
                  <CategoryCell tx={tx} categories={txCategories} onSave={handleCategorySaved} />
                </td>
                <td className="px-5 py-3">
                  <CardBadge cardSlug={tx.card_slug} accountName={tx.account_name} />
                </td>
                <td className={cn(
                  "px-5 py-3 text-right font-mono tabular-nums whitespace-nowrap text-[13px] font-medium",
                  tx.amount < 0 ? "text-semantic-income" : "text-ink-primary"
                )}>
                  {tx.amount < 0 ? `+${fmt(Math.abs(tx.amount))}` : fmt(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary font-mono">
            {data.total.toLocaleString()} transactions · page {page} of {data.pages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="hive-btn-secondary py-1.5 px-3 text-[12px] disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="hive-btn-secondary py-1.5 px-3 text-[12px] disabled:opacity-30"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
