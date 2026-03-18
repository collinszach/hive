"use client";

import { useState } from "react";
import { api, CardOption } from "@/lib/api";
import { fmt, ALL_CATEGORIES, SUBCATEGORIES, CARD_NAMES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Zap, Trophy } from "lucide-react";

const PROGRAM_ACCENTS: Record<string, string> = {
  "Amex MR":           "border-emerald-500/30 bg-emerald-500/5",
  "Chase UR":          "border-blue-500/30 bg-blue-500/5",
  "SW RR":             "border-orange-500/30 bg-orange-500/5",
  "Bilt Points":       "border-violet-500/30 bg-violet-500/5",
  "WF Rewards":        "border-red-500/30 bg-red-500/5",
  "Capital One Miles": "border-sky-500/30 bg-sky-500/5",
};

const PROGRAM_VALUE_COLORS: Record<string, string> = {
  "Amex MR":           "text-emerald-400",
  "Chase UR":          "text-blue-400",
  "SW RR":             "text-orange-400",
  "Bilt Points":       "text-violet-400",
  "WF Rewards":        "text-red-400",
  "Capital One Miles": "text-sky-400",
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

  const best = cards[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Card Optimizer</h1>
        <p className="text-sm text-slate-500 mt-0.5">Find the best card to use at checkout</p>
      </div>

      {/* Input form */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Any category</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
              Subcategory
            </label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-40 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Any subcategory</option>
              {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
              Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && optimize()}
            />
          </div>
        </div>

        <button
          onClick={optimize}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          <Zap className="w-4 h-4" />
          {loading ? "Calculating…" : "Find Best Card"}
        </button>
      </div>

      {/* Winner callout */}
      {searched && best && (
        <div className={cn(
          "rounded-xl border p-5",
          PROGRAM_ACCENTS[best.program] ?? "border-indigo-500/30 bg-indigo-500/5"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Best Card</span>
          </div>
          <p className="text-lg font-bold text-white">{CARD_NAMES[best.card_slug] ?? best.card_slug}</p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-slate-400">{best.earn_rate}x on {category || "this purchase"}</span>
            <span className="text-slate-400">·</span>
            <span className="font-semibold text-slate-200">{Math.round(best.points_earned).toLocaleString()} pts</span>
            <span className="text-slate-400">·</span>
            <span className={cn("font-bold text-base", PROGRAM_VALUE_COLORS[best.program] ?? "text-emerald-400")}>
              {fmt(best.dollar_value)} value
            </span>
          </div>
        </div>
      )}

      {/* Full rankings */}
      {searched && cards.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">All Cards Ranked</p>
          {cards.map((card, i) => (
            <div
              key={card.card_slug}
              className={cn(
                "rounded-xl border px-4 py-3 flex items-center justify-between gap-4",
                i === 0
                  ? (PROGRAM_ACCENTS[card.program] ?? "border-indigo-500/30 bg-indigo-500/5")
                  : "border-slate-800 bg-slate-900"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0",
                  i === 0 ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-500"
                )}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-200">{CARD_NAMES[card.card_slug] ?? card.card_slug}</p>
                  <p className="text-xs text-slate-500">{card.program}</p>
                </div>
              </div>

              <div className="flex items-center gap-5 shrink-0 text-right">
                <div>
                  <p className="text-xs text-slate-600">Earn rate</p>
                  <p className="font-bold text-slate-200">{card.earn_rate}x</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Points</p>
                  <p className="font-medium text-slate-300 tabular-nums">{Math.round(card.points_earned).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Value</p>
                  <p className={cn(
                    "font-bold tabular-nums",
                    i === 0 ? (PROGRAM_VALUE_COLORS[card.program] ?? "text-emerald-400") : "text-slate-400"
                  )}>
                    {fmt(card.dollar_value)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searched && cards.length > 0 && (
        <p className="text-xs text-slate-600">
          Values based on estimated points valuations (CPP). Actual redemption value may vary.
        </p>
      )}
    </div>
  );
}
