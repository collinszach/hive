"use client";

import { useState, useRef } from "react";
import { Check, X, ArrowRight, Trash2 } from "lucide-react";
import { fmt } from "@/lib/utils";
import { api, ProgramSummary } from "@/lib/api";
import { toast } from "@/components/Toast";

interface ProgramCardProps {
  program: ProgramSummary;
  onBalanceUpdate: (program: string, balance: number) => void;
  onCleared?: () => void;
  onViewActivity?: (program: string) => void;
  threshold?: number;
}

export function ProgramCard({ program: p, onBalanceUpdate, onCleared, onViewActivity, threshold }: ProgramCardProps) {
  const [editing, setEditing]     = useState(false);
  const [inputVal, setInputVal]   = useState(String(p.manual_balance ?? ""));
  const [saving, setSaving]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setInputVal(String(p.manual_balance ?? ""));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function commitEdit() {
    const parsed = parseInt(inputVal.replace(/,/g, ""), 10);
    if (isNaN(parsed) || parsed < 0) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await api.points.setBalance(p.program, parsed);
      onBalanceUpdate(p.program, parsed);
      setEditing(false);
    } catch {
      toast.error("Failed to save balance");
    } finally {
      setSaving(false);
    }
  }

  async function clearBalance() {
    setSaving(true);
    try {
      await api.points.deleteBalance(p.program);
      setEditing(false);
      onCleared?.();
    } catch {
      toast.error("Failed to clear balance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="hive-card-rewards p-5 space-y-4 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-medium text-ink-primary">{p.program}</p>
        </div>
        <div className="px-2.5 py-1 rounded-lg text-[13px] font-semibold font-mono tabular-nums bg-white/[0.05] text-[#9aa0b0] border border-white/[0.08]">
          {fmt(p.estimated_value_dollars)}
        </div>
      </div>

      {/* Redemption threshold badge */}
      {threshold && p.manual_balance !== null && p.manual_balance >= threshold && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-semantic-income/10 border border-semantic-income/20">
          <span className="text-[11px] font-medium text-semantic-income">Ready to redeem</span>
          <span className="text-[10px] text-ink-tertiary font-mono">
            {p.manual_balance.toLocaleString()} / {threshold.toLocaleString()} pts
          </span>
        </div>
      )}

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
              {p.manual_balance !== null && (
                <button
                  type="button"
                  onClick={clearBalance}
                  disabled={saving}
                  title="Remove manual balance (revert to earned points)"
                  className="text-semantic-expense hover:opacity-80 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
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
        {/* Earned in window */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary">Earned (window)</span>
          <span className="text-[12px] font-mono text-ink-secondary tabular-nums">
            {Math.round(p.points_earned_90d).toLocaleString()} pts
          </span>
        </div>

      </div>

      {/* Footer link */}
      {onViewActivity && (
        <button
          type="button"
          onClick={() => onViewActivity(p.program)}
          className="flex items-center gap-1 text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors group"
        >
          View earn activity
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
