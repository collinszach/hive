"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { api, ExpenseShare, SettlementCandidate, matchLabel } from "@/lib/api";
import { fmt, fmtDate, cn } from "@/lib/utils";
import { toast } from "@/components/Toast";

interface SettleShareModalProps {
  /** The share being settled, or null when closed. */
  share: ExpenseShare | null;
  onClose: () => void;
  /** Called after a successful settle so the caller can refresh. */
  onSettled: () => void;
}

/**
 * "Which payment was this?" — pick the transaction that cleared a share.
 *
 * A repayment is an ordinary money-in transaction with nothing marking it as a
 * repayment, so the backend ranks plausible ones and this lists them strongest
 * first. Linking is optional: plenty of people pay in cash, so "settled outside
 * HIVE" is a first-class choice rather than a dead end.
 */
export function SettleShareModal({ share, onClose, onSettled }: SettleShareModalProps) {
  const [candidates, setCandidates] = useState<SettlementCandidate[]>([]);
  const [otherPending, setOtherPending] = useState<ExpenseShare[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [alsoSettleOthers, setAlsoSettleOthers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!share) return;
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    setAlsoSettleOthers(false);

    (async () => {
      try {
        const [cands, pending] = await Promise.all([
          api.shares.settlementCandidates(share.id),
          api.shares.pending(),
        ]);
        if (cancelled) return;
        setCandidates(cands);
        setOtherPending(
          pending.filter((p) => p.contact_id === share.contact_id && p.id !== share.id)
        );
        // Pre-select a single unambiguous match so the common case is one click,
        // but never guess when several candidates are equally strong.
        const strong = cands.filter((c) => c.match === "exact" || c.match === "batch");
        if (strong.length === 1) setSelected(strong[0].transaction_id);
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [share]);

  if (!share) return null;

  const otherTotal = otherPending.reduce((sum, s) => sum + s.amount, 0);

  async function handleConfirm() {
    if (!share) return;
    setSaving(true);
    try {
      if (alsoSettleOthers && otherPending.length > 0) {
        await api.shares.settleBatch(
          [share.id, ...otherPending.map((s) => s.id)],
          selected
        );
        toast.success(`Settled ${otherPending.length + 1} shares`);
      } else {
        await api.shares.settle(share.id, selected ?? undefined);
        toast.success("Marked as paid back");
      }
      onSettled();
      onClose();
    } catch {
      toast.error("Failed to settle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto hive-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-ink-primary">Mark as paid back</h2>
            <p className="text-[12px] text-ink-tertiary mt-0.5">
              {share.contact_name} owes {fmt(share.amount)}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-ghost hover:text-ink-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {otherPending.length > 0 && (
          <button
            type="button"
            onClick={() => setAlsoSettleOthers((v) => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] transition-colors text-left"
          >
            <span className={cn(
              "w-4 h-4 rounded border flex items-center justify-center shrink-0",
              alsoSettleOthers ? "bg-honey border-honey" : "border-white/20"
            )}>
              {alsoSettleOthers && <Check className="w-3 h-3 text-black" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] text-ink-primary">
                Also settle {otherPending.length} more
              </span>
              <span className="block text-[11px] text-ink-tertiary">
                {share.contact_name} owes {fmt(otherTotal)} besides this one
              </span>
            </span>
          </button>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider">
            Which payment was this?
          </p>

          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors",
              selected === null ? "bg-honey/10 border border-honey/30" : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
            )}
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] text-ink-primary">Settled outside HIVE</span>
              <span className="block text-[11px] text-ink-tertiary">
                Cash, or a payment that never hit a linked account
              </span>
            </span>
            {selected === null && <Check className="w-3.5 h-3.5 text-honey shrink-0" />}
          </button>

          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-ink-tertiary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding payments…
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <p className="px-3 py-3 text-[12px] text-ink-tertiary">
              No money-in transactions since this charge.
            </p>
          )}

          {!loading && candidates.map((c) => {
            const label = matchLabel(c.match);
            const isSel = selected === c.transaction_id;
            return (
              <button
                key={c.transaction_id}
                type="button"
                onClick={() => setSelected(isSel ? null : c.transaction_id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors",
                  isSel ? "bg-honey/10 border border-honey/30" : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] text-ink-primary truncate">{c.description}</span>
                  <span className="block text-[11px] text-ink-tertiary">
                    {fmtDate(c.date)}
                    {label && <span className="text-semantic-income"> · {label}</span>}
                  </span>
                </span>
                <span className="text-[12px] font-mono text-ink-primary tabular-nums shrink-0">
                  {fmt(c.amount)}
                </span>
                {isSel && <Check className="w-3.5 h-3.5 text-honey shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] text-ink-tertiary hover:text-ink-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-honey text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving…" : "Mark as paid back"}
          </button>
        </div>
      </div>
    </div>
  );
}
