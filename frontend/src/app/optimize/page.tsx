"use client";

import { useState } from "react";
import { api, CardOption } from "@/lib/api";
import { fmt, ALL_CATEGORIES, SUBCATEGORIES, CARD_NAMES } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PROGRAM_COLORS: Record<string, string> = {
  "Amex MR": "border-green-500/40 bg-green-900/10",
  "Chase UR": "border-blue-500/40 bg-blue-900/10",
  "SW RR": "border-orange-500/40 bg-orange-900/10",
  "Bilt Points": "border-purple-500/40 bg-purple-900/10",
  "WF Rewards": "border-red-500/40 bg-red-900/10",
  "Capital One Miles": "border-sky-500/40 bg-sky-900/10",
};

export default function OptimizerPage() {
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [amount, setAmount] = useState("100");
  const [cards, setCards] = useState<CardOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const subcats = SUBCATEGORIES[category] ?? [];

  async function optimize() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setLoading(true);
    try {
      const res = await api.points.optimize({
        category: category || undefined,
        subcategory: subcategory || undefined,
        amount: amt,
      });
      setCards(res.cards);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Card Optimizer</h1>
        <p className="text-sm text-gray-500 mt-1">Find the best card to use at checkout</p>
      </div>

      {/* Input form */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Any category</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Subcategory</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              <option value="">Any subcategory</option>
              {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              onKeyDown={(e) => e.key === "Enter" && optimize()}
            />
          </div>
        </div>

        <button
          onClick={optimize}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Calculating…" : "Find Best Card"}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          {cards.map((card, i) => (
            <div
              key={card.card_slug}
              className={cn(
                "rounded-xl border p-4 flex items-center justify-between gap-4",
                card.is_best
                  ? (PROGRAM_COLORS[card.program] ?? "border-indigo-500/40 bg-indigo-900/10") + " ring-1 ring-indigo-500/30"
                  : "border-gray-800 bg-gray-900"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold shrink-0",
                  card.is_best ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-400"
                )}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{CARD_NAMES[card.card_slug] ?? card.card_slug}</p>
                  <p className="text-xs text-gray-400">{card.program}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Earn rate</p>
                  <p className="font-bold text-lg">{card.earn_rate}x</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Points</p>
                  <p className="font-semibold">{Math.round(card.points_earned).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Value</p>
                  <p className={cn("font-bold", card.is_best ? "text-emerald-400" : "text-gray-300")}>
                    {fmt(card.dollar_value)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searched && cards.length > 0 && (
        <p className="text-xs text-gray-600">
          Values based on estimated points valuations (CPP). Actual redemption value may vary.
        </p>
      )}
    </div>
  );
}
