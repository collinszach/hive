"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, CardOption } from "@/lib/api";
import { fmt, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Zap, Trophy } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { PageHero } from "@/components/PageHero";
import { toast } from "@/components/Toast";

const PROGRAM_VALUE_COLORS: Record<string, string> = {
  "Amex MR":           "text-emerald-400",
  "Chase UR":          "text-sky-400",
  "SW RR":             "text-orange-400",
  "Bilt Points":       "text-violet-400",
  "Capital One Miles": "text-blue-400",
};

export default function OptimizerPage() {
  const router = useRouter();
  const [category, setCategory]       = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [amount, setAmount]           = useState("100");
  const [cards, setCards]             = useState<CardOption[]>([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);

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
    } catch {
      toast.error("Failed to load card recommendations");
    } finally {
      setLoading(false);
    }
  }

  const best = cards[0];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <PageHero
        eyebrow="Card Optimizer"
        headline={searched && best
          ? <><span className="text-honey">{best.earn_rate}x</span> on {category || "everything"}</>
          : <span className="text-ink-secondary">Maximize Points</span>
        }
        subtext={searched && best
          ? `${best.account_name ?? best.card_slug} · ${Math.round(best.points_earned).toLocaleString()} pts · ${fmt(best.dollar_value)} value`
          : "find the best card to use at checkout"
        }
        glowColor="honey"
        statStrip={searched && best ? [
          { label: "Best Card", value: best.account_name ?? best.card_slug, color: "amber" },
          { label: "Earn Rate", value: `${best.earn_rate}x`, color: "default" },
          { label: "Value", value: fmt(best.dollar_value), color: "green" },
        ] : undefined}
      />

      {/* ── Input Form ──────────────────────────────────────────────── */}
      <div className="hive-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="hive-label block mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
              className="hive-select w-full"
            >
              <option value="">Any category</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="hive-label block mb-2">Subcategory</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
              className="hive-select w-full disabled:opacity-40"
            >
              <option value="">Any subcategory</option>
              {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="hive-label block mb-2">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
              className="hive-input font-mono"
              onKeyDown={(e) => e.key === "Enter" && optimize()}
            />
          </div>
        </div>

        <button
          onClick={optimize}
          disabled={loading}
          className="hive-btn-primary"
        >
          <Zap className="w-4 h-4" />
          {loading ? "Calculating…" : "Find Best Card"}
        </button>
      </div>

      {/* ── Winner ──────────────────────────────────────────────────── */}
      {searched && best && (
        <GlassCard tint="income" className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-honey" />
            <span className="hive-label text-honey/80">Best Card</span>
          </div>
          <p className="text-[18px] font-semibold text-ink-primary mb-3">
            {best.account_name ?? best.card_slug}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[13px] text-ink-secondary">
              {best.earn_rate}x on {category || "this purchase"}
            </span>
            <span className="text-ink-tertiary/30">·</span>
            <span className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums">
              {Math.round(best.points_earned).toLocaleString()} pts
            </span>
            <span className="text-ink-tertiary/30">·</span>
            <span className={cn("text-[15px] font-bold font-mono tabular-nums", PROGRAM_VALUE_COLORS[best.program] ?? "text-semantic-income")}>
              {fmt(best.dollar_value)} value
            </span>
          </div>
        </GlassCard>
      )}

      {/* ── Rankings ────────────────────────────────────────────────── */}
      {searched && cards.length > 1 && (
        <div className="space-y-2">
          <p className="hive-label">All Cards Ranked</p>
          <div className="space-y-1.5">
            {cards.map((card, i) => (
              <GlassCard
                key={card.card_slug}
                tint={i === 0 ? "none" : "none"}
                className={cn(
                  "flex items-center justify-between gap-4 px-5 py-3.5 transition-colors cursor-pointer hover:bg-white/[0.03]",
                  i === 0 ? "bg-honey/[0.04] border-honey/[0.08]" : ""
                )}
                onClick={() => router.push(`/points?program=${encodeURIComponent(card.program)}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold shrink-0",
                    i === 0 ? "bg-honey/20 text-honey" : "bg-white/[0.05] text-ink-tertiary"
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink-primary">
                      {card.account_name ?? card.card_slug}
                    </p>
                    <p className="text-[11px] text-ink-tertiary">{card.program}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Rate</p>
                    <p className="text-[13px] font-semibold text-ink-secondary">{card.earn_rate}x</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Points</p>
                    <p className="text-[12px] font-mono text-ink-secondary tabular-nums">
                      {Math.round(card.points_earned).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Value</p>
                    <p className={cn(
                      "text-[13px] font-bold font-mono tabular-nums",
                      i === 0
                        ? (PROGRAM_VALUE_COLORS[card.program] ?? "text-semantic-income")
                        : "text-ink-tertiary"
                    )}>
                      {fmt(card.dollar_value)}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {searched && cards.length > 0 && (
        <p className="text-[11px] text-ink-tertiary/50">
          Values based on estimated cents-per-point (CPP). Actual redemption value may vary by transfer partner.
        </p>
      )}
    </div>
  );
}
