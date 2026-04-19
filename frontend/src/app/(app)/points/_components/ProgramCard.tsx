"use client";

import { useState, useRef } from "react";
import { Bell, Check, X } from "lucide-react";
import { cn, fmt } from "@/lib/utils";
import { api, ProgramSummary } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";

const PROGRAM_ACCENTS: Record<string, { bar: string; text: string; bg: string }> = {
  "Amex MR":           { bar: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10" },
  "Chase UR":          { bar: "bg-sky-400",      text: "text-sky-400",     bg: "bg-sky-400/10"     },
  "SW RR":             { bar: "bg-orange-400",   text: "text-orange-400",  bg: "bg-orange-400/10"  },
  "Bilt Points":       { bar: "bg-violet-400",   text: "text-violet-400",  bg: "bg-violet-400/10"  },
  "WF Rewards":        { bar: "bg-rose-400",     text: "text-rose-400",    bg: "bg-rose-400/10"    },
  "Capital One Miles": { bar: "bg-blue-400",     text: "text-blue-400",    bg: "bg-blue-400/10"    },
};

interface ProgramCardProps {
  program: ProgramSummary;
  onBalanceUpdate: (program: string, balance: number) => void;
}

export function ProgramCard({ program: p, onBalanceUpdate }: ProgramCardProps) {
  const [editing, setEditing]     = useState(false);
  const [inputVal, setInputVal]   = useState(String(p.manual_balance ?? ""));
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent = PROGRAM_ACCENTS[p.program] ?? { bar: "bg-honey", text: "text-honey", bg: "bg-honey/10" };

  const balanceForProgress = p.manual_balance ?? p.points_earned_90d;
  const progress = p.redemption_threshold
    ? Math.min((balanceForProgress / p.redemption_threshold) * 100, 100)
    : null;

  function startEdit() {
    setInputVal(String(p.manual_balance ?? ""));
    setSaveError(false);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(false);
  }

  async function commitEdit() {
    const parsed = parseInt(inputVal.replace(/,/g, ""), 10);
    if (isNaN(parsed) || parsed < 0) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      await api.points.setBalance(p.program, parsed);
      onBalanceUpdate(p.program, parsed);
      setEditing(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard
      tint="amber"
      className={cn(
        "p-5 space-y-4 transition-all duration-200",
        p.above_threshold && "border-honey/30",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-medium text-ink-primary">{p.program}</p>
          {p.above_threshold && (
            <div className="flex items-center gap-1.5 mt-1">
              <Bell className="w-3 h-3 text-honey" />
              <span className="text-[11px] text-honey font-medium">Ready to redeem</span>
            </div>
          )}
        </div>
        <div className={cn("px-2.5 py-1 rounded-lg text-[13px] font-semibold font-mono tabular-nums", accent.bg, accent.text)}>
          {fmt(p.estimated_value_dollars)}
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        {/* Balance row — editable */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary">Balance</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="w-24 text-right text-[12px] font-mono bg-white/[0.06] border border-white/[0.12] rounded px-1.5 py-0.5 text-ink-primary focus:outline-none focus:border-honey/40"
                placeholder="0"
              />
              <button
                type="button"
                onClick={commitEdit}
                disabled={saving}
                className="text-semantic-income hover:opacity-80 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={cancelEdit} className="text-ink-tertiary hover:opacity-80">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="group flex items-center gap-1"
            >
              {p.manual_balance !== null ? (
                <span className="text-[12px] font-mono text-ink-secondary tabular-nums group-hover:text-ink-primary transition-colors">
                  {p.manual_balance.toLocaleString()} pts
                </span>
              ) : (
                <span className="text-[12px] text-ink-tertiary/40 group-hover:text-ink-tertiary transition-colors">
                  Add balance
                </span>
              )}
            </button>
          )}
        </div>
        {saveError && (
          <p className="text-[11px] text-semantic-expense">Failed to save — try again</p>
        )}

        {/* Earned in window */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary">Earned (window)</span>
          <span className="text-[12px] font-mono text-ink-secondary tabular-nums">
            {Math.round(p.points_earned_90d).toLocaleString()} pts
          </span>
        </div>

        {/* Threshold */}
        {p.redemption_threshold && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-tertiary">Threshold</span>
            <span className="text-[12px] font-mono text-ink-tertiary tabular-nums">
              {p.redemption_threshold.toLocaleString()} pts
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div>
          <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", accent.bar)}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-ink-tertiary/60 mt-1.5">
            {p.above_threshold
              ? "Above redemption threshold"
              : `${(p.redemption_threshold! - balanceForProgress).toLocaleString()} pts to threshold`}
          </p>
        </div>
      )}
    </GlassCard>
  );
}
