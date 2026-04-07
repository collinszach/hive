"use client";

import { useState, useEffect } from "react";
import { cn, fmt, fmtDate, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { api, Transaction } from "@/lib/api";

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Drink":   "🍽️",
  "Groceries":      "🛒",
  "Travel":         "✈️",
  "Transportation": "🚗",
  "Entertainment":  "🎬",
  "Shopping":       "🛍️",
  "Health":         "🏥",
  "Utilities":      "💡",
  "Home":           "🏠",
  "Education":      "📚",
  "Personal Care":  "💆",
  "Transfers":      "🔄",
  "Business":       "💼",
  "Uncategorized":  "📋",
};

interface TransactionDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  onCategoryChange?: (id: string, category: string, subcategory: string | null) => void;
}

export function TransactionDrawer({ transaction, onClose, onCategoryChange }: TransactionDrawerProps) {
  const [category, setCategory] = useState<string>("");
  const [subcategory, setSubcategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [similarTxns, setSimilarTxns] = useState<Transaction[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (transaction) {
      setCategory(transaction.category ?? "Uncategorized");
      setSubcategory(transaction.subcategory ?? "");
    }
  }, [transaction]);

  useEffect(() => {
    if (!transaction?.merchant) {
      setSimilarTxns([]);
      return;
    }
    setLoadingSimilar(true);
    api.transactions
      .list({ search: transaction.merchant, page_size: 5 })
      .then((res) => {
        setSimilarTxns(res.items.filter((t) => t.id !== transaction.id).slice(0, 4));
      })
      .catch(() => setSimilarTxns([]))
      .finally(() => setLoadingSimilar(false));
  }, [transaction?.merchant, transaction?.id]);

  async function handleSave() {
    if (!transaction) return;
    setSaving(true);
    try {
      await api.transactions.updateCategory(transaction.id, category, subcategory);
      onCategoryChange?.(transaction.id, category, subcategory || null);
      onClose();
    } catch {
      // swallow — user can retry
    } finally {
      setSaving(false);
    }
  }

  const isOpen = transaction !== null;
  const isIncome = (transaction?.amount ?? 0) < 0;
  const emoji = CATEGORY_EMOJI[transaction?.category ?? ""] ?? "📋";
  const subcategoryOptions = SUBCATEGORIES[category] ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md bg-[#0F1117] border-l border-white/[0.06]",
          "flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-ink-primary">Transaction Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.10] transition-colors text-ink-secondary text-[18px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {transaction && (
          <div className="flex-1 overflow-y-auto">
            {/* Hero section */}
            <div className="px-5 py-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center text-2xl">
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-ink-primary truncate">
                    {transaction.merchant ?? transaction.raw_description}
                  </p>
                  <p className="text-[12px] text-ink-tertiary mt-0.5">
                    {fmtDate(transaction.date)} · {transaction.account_name ?? "Unknown account"}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <p
                className={cn(
                  "text-3xl font-bold font-mono tabular-nums mt-1",
                  isIncome ? "text-emerald-400" : "text-ink-primary"
                )}
              >
                {isIncome ? "+" : ""}
                {fmt(Math.abs(transaction.amount))}
              </p>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {transaction.pending && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending
                  </span>
                )}
                {transaction.is_excluded && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    Excluded
                  </span>
                )}
                {transaction.payment_channel && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] text-ink-tertiary border border-white/[0.06] capitalize">
                    {transaction.payment_channel}
                  </span>
                )}
                {transaction.card_slug && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-honey/[0.08] text-honey border border-honey/[0.15]">
                    {transaction.card_slug.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>

            {/* Category editor */}
            <div className="px-5 py-5 border-b border-white/[0.06]">
              <p className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                Category
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] text-ink-secondary mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubcategory("");
                    }}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#161921]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {subcategoryOptions.length > 0 && (
                  <div>
                    <label className="block text-[12px] text-ink-secondary mb-1.5">Subcategory</label>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
                    >
                      <option value="" className="bg-[#161921]">
                        — none —
                      </option>
                      {subcategoryOptions.map((sub) => (
                        <option key={sub} value={sub} className="bg-[#161921]">
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150",
                    saving
                      ? "bg-honey/30 text-honey/50 cursor-not-allowed"
                      : "bg-honey/[0.12] border border-honey/25 text-honey hover:bg-honey/[0.18]"
                  )}
                >
                  {saving ? "Saving…" : "Save Category"}
                </button>
              </div>
            </div>

            {/* Similar transactions */}
            {(loadingSimilar || similarTxns.length > 0) && (
              <div className="px-5 py-5">
                <p className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                  Similar Transactions
                </p>
                {loadingSimilar ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {similarTxns.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-ink-primary truncate">
                            {t.merchant ?? t.raw_description}
                          </p>
                          <p className="text-[11px] text-ink-tertiary">{fmtDate(t.date)}</p>
                        </div>
                        <span className="text-[12px] font-mono font-medium text-ink-secondary ml-3 tabular-nums">
                          {fmt(Math.abs(t.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
