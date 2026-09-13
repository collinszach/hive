"use client";

import { useState } from "react";
import { Check, X, Undo2, Plane } from "lucide-react";
import { api, Redemption } from "@/lib/api";
import { fmt, fmtDate } from "@/lib/utils";
import { toast } from "@/components/Toast";

interface Props {
  candidates: Redemption[];
  programs: string[];
  onReviewed: () => void;
}

/**
 * "Did you book this with points?" — the review queue for award-fee candidates.
 *
 * An award booking pays the fare in points, so nothing reaches the card except taxes
 * and fees. That small airline charge is the only trace a redemption leaves, and
 * without confirming it the displayed balance drifts upward forever. Detection can
 * see that points were probably spent; only the user knows how many.
 */
export function RedemptionReview({ candidates, programs, onReviewed }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [program, setProgram] = useState("");
  const [points, setPoints] = useState("");
  const [cashValue, setCashValue] = useState("");
  const [saving, setSaving] = useState(false);

  if (candidates.length === 0) return null;

  function startReview(r: Redemption) {
    setOpenId(r.id);
    setProgram(programs[0] ?? "");
    setPoints("");
    setCashValue("");
  }

  async function confirm(r: Redemption) {
    const pts = parseFloat(points);
    if (!program || !Number.isFinite(pts) || pts <= 0) {
      toast.error("Pick a program and how many points it cost");
      return;
    }
    setSaving(true);
    try {
      await api.points.confirmRedemption(r.id, {
        program,
        points_spent: pts,
        cash_value_avoided: cashValue ? parseFloat(cashValue) : null,
      });
      toast.success(`${pts.toLocaleString()} ${program} deducted`);
      setOpenId(null);
      onReviewed();
    } catch {
      toast.error("Failed to confirm");
    } finally {
      setSaving(false);
    }
  }

  async function dismiss(r: Redemption) {
    try {
      await api.points.dismissRedemption(r.id);
      toast.success("Dismissed");
      onReviewed();
    } catch {
      toast.error("Failed to dismiss");
    }
  }

  return (
    <div className="hive-card p-5 space-y-3 border border-honey/20">
      <div className="flex items-center gap-2">
        <Plane className="w-4 h-4 text-honey" />
        <p className="text-[13px] font-medium text-ink-primary">
          {candidates.length} possible {candidates.length === 1 ? "redemption" : "redemptions"} to review
        </p>
      </div>
      <p className="text-[11px] text-ink-tertiary leading-relaxed">
        An award booking pays the fare in points, so only taxes hit the card. These
        small charges look like that. Until they&apos;re confirmed, your balances are
        overstated by whatever those tickets cost.
      </p>

      <div className="space-y-2">
        {candidates.map((r) => (
          <div key={r.id} className="rounded-lg bg-white/[0.03] p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-ink-primary">
                  {r.merchant ?? "Unknown"} · {fmtDate(r.redeemed_on)} · {fmt(r.fees_paid)}
                </p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">{r.explanation}</p>
              </div>
              {openId !== r.id && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => startReview(r)}
                    className="px-2 py-1 text-[11px] font-medium rounded bg-honey text-black hover:opacity-90"
                  >
                    Yes, points
                  </button>
                  <button
                    onClick={() => dismiss(r)}
                    title="Not a redemption"
                    className="p-1 rounded text-ink-ghost hover:text-semantic-expense"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {openId === r.id && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="text-[11px] bg-white/[0.06] border border-white/[0.12] rounded px-2 py-1 text-ink-primary focus:outline-none focus:border-honey/40"
                >
                  {programs.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="points spent"
                  inputMode="numeric"
                  className="w-28 text-[11px] font-mono bg-white/[0.06] border border-white/[0.12] rounded px-2 py-1 text-ink-primary focus:outline-none focus:border-honey/40"
                />
                <input
                  value={cashValue}
                  onChange={(e) => setCashValue(e.target.value)}
                  placeholder="cash price (optional)"
                  inputMode="decimal"
                  title="What the cash ticket would have cost — gives you cents-per-point"
                  className="w-36 text-[11px] font-mono bg-white/[0.06] border border-white/[0.12] rounded px-2 py-1 text-ink-primary focus:outline-none focus:border-honey/40"
                />
                <button
                  onClick={() => confirm(r)}
                  disabled={saving}
                  className="p-1 rounded text-semantic-income hover:opacity-80 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpenId(null)}
                  className="p-1 rounded text-ink-tertiary hover:text-ink-primary"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
