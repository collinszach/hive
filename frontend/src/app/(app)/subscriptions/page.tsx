"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, Subscription, SubscriptionSummary } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import {
  Repeat2, AlertTriangle, X, ScanLine, Loader2, CheckCircle2,
  Pencil, Trash2, Plus, Check,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { toast } from "@/components/Toast";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const FREQ_SUFFIX: Record<string, string> = {
  weekly: "wk",
  monthly: "mo",
  quarterly: "qtr",
  annual: "yr",
};

const FREQ_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

const CATEGORIES = [
  "Entertainment", "Food & Drink", "Health", "Home", "Shopping",
  "Transportation", "Utilities", "Education", "Business", "Other",
];

function annualCost(sub: Subscription): number {
  return sub.annual_cost ?? sub.amount * (FREQ_MULTIPLIER[sub.frequency] ?? 12);
}

interface EditState {
  merchant_name: string;
  amount: string;
  frequency: string;
  category: string;
}

interface AddState {
  merchant_name: string;
  amount: string;
  frequency: string;
  category: string;
}

export default function SubscriptionsPage() {
  const searchParams                = useSearchParams();
  const targetId                    = searchParams.get("id");
  const rowRefs                     = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightId, setHighlightId] = useState<string | null>(targetId);
  const [data, setData]             = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [scanning, setScanning]     = useState(false);
  const [scanDone, setScanDone]     = useState(false);

  // Edit state: which sub is being edited, and its draft values
  const [editing, setEditing]       = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState<EditState | null>(null);
  const [saving, setSaving]         = useState(false);

  // Add manually
  const [showAdd, setShowAdd]       = useState(false);
  const [addDraft, setAddDraft]     = useState<AddState>({ merchant_name: "", amount: "", frequency: "monthly", category: "" });
  const [adding, setAdding]         = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    api.subscriptions.list(true)
      .then(setData)
      .catch(() => toast.error("Failed to load subscriptions"))
      .finally(() => setLoading(false));
  }, []);

  // Scroll to and briefly highlight the targeted subscription on deep-link
  useEffect(() => {
    if (!targetId || loading) return;
    const el = rowRefs.current.get(targetId);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => setHighlightId(null), 2000);
      }, 150);
    }
  }, [targetId, loading]);

  async function refresh() {
    const d = await api.subscriptions.list(true);
    setData(d);
  }

  async function handleScan() {
    setScanning(true);
    setScanDone(false);
    try {
      await api.subscriptions.scan();
      await new Promise((r) => setTimeout(r, 3500));
      await refresh();
      setScanDone(true);
      setTimeout(() => setScanDone(false), 4000);
      toast.success("Subscriptions scanned and updated");
    } catch {
      toast.error("Scan failed — try again");
    } finally {
      setScanning(false);
    }
  }

  async function handleCancel(id: string) {
    setCancelling(id);
    try {
      await api.subscriptions.update(id, { is_cancelled: true, is_active: false });
      await refresh();
      toast.success("Subscription marked as cancelled");
    } catch {
      toast.error("Failed to cancel subscription");
    } finally {
      setCancelling(null);
    }
  }

  function startEdit(sub: Subscription) {
    setEditing(sub.id);
    setEditDraft({
      merchant_name: sub.merchant_name,
      amount: String(sub.amount),
      frequency: sub.frequency,
      category: sub.category ?? "",
    });
    setConfirmDelete(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    setSaving(true);
    try {
      await api.subscriptions.update(id, {
        merchant_name: editDraft.merchant_name.trim(),
        amount: parseFloat(editDraft.amount),
        frequency: editDraft.frequency,
        category: editDraft.category || undefined,
      });
      await refresh();
      cancelEdit();
      toast.success("Subscription updated");
    } catch {
      toast.error("Failed to update subscription");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.subscriptions.delete(id);
      await refresh();
      setConfirmDelete(null);
      toast.success("Subscription removed");
    } catch {
      toast.error("Failed to remove subscription");
    } finally {
      setDeleting(null);
    }
  }

  async function handleAdd() {
    if (!addDraft.merchant_name.trim() || !addDraft.amount) return;
    setAdding(true);
    try {
      await api.subscriptions.create({
        merchant_name: addDraft.merchant_name.trim(),
        amount: parseFloat(addDraft.amount),
        frequency: addDraft.frequency,
        category: addDraft.category || undefined,
      });
      await refresh();
      setShowAdd(false);
      setAddDraft({ merchant_name: "", amount: "", frequency: "monthly", category: "" });
      toast.success("Subscription added");
    } catch {
      toast.error("Failed to add subscription");
    } finally {
      setAdding(false);
    }
  }

  const subs = data?.subscriptions ?? [];
  const priceAlerts = subs.filter((s) => s.previous_amount !== null);
  const monthlyTotal = data?.total_monthly_cost ?? 0;
  const annualTotal  = data?.total_annual_cost ?? 0;
  const count        = data?.count ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* PageHero */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <PageHero
            eyebrow="Subscriptions"
            headline={
              <>
                <span className="text-honey">{fmt(monthlyTotal)}</span>/mo
              </>
            }
            subtext="detected recurring charges"
            glow="red"
            statStrip={[
              { label: "Monthly", value: fmt(monthlyTotal), color: "amber" },
              { label: "Annual",  value: fmt(annualTotal),  color: "red"   },
              { label: "Active",  value: String(count),     color: "default" },
            ]}
          />
        </div>
        <div className="flex gap-2 mt-1 shrink-0 self-start">
          <button
            onClick={() => { setShowAdd(true); setEditing(null); setConfirmDelete(null); }}
            className="hive-btn-secondary text-[12px] px-3 py-1.5 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add manually
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="hive-btn-secondary text-[12px] px-3 py-1.5 gap-1.5"
          >
            {scanning
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : scanDone
              ? <CheckCircle2 className="w-3.5 h-3.5 text-semantic-income" />
              : <ScanLine className="w-3.5 h-3.5" />
            }
            {scanning ? "Scanning…" : scanDone ? "Updated!" : "Re-scan"}
          </button>
        </div>
      </div>

      {/* Total callout */}
      {data && (
        <div className="hive-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-ink-ghost mb-1">Monthly recurring</p>
              <p className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-primary tabular-nums font-mono">
                {fmt(monthlyTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-ink-ghost mb-1">Annual projection</p>
              <p className="text-[20px] font-semibold text-semantic-expense tabular-nums font-mono">
                {fmt(annualTotal)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price alerts */}
      {priceAlerts.length > 0 && (
        <div className="hive-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-semantic-expense" />
            <p className="text-[13px] font-semibold text-semantic-expense">Price Changes Detected</p>
          </div>
          <div className="space-y-2">
            {priceAlerts.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-primary">{s.merchant_name}</span>
                <span className="font-mono text-ink-tertiary line-through">{fmt(s.previous_amount!)}</span>
                <span className="font-mono text-semantic-expense font-semibold">→ {fmt(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add manually form */}
      {showAdd && (
        <div className="hive-card p-4">
          <p className="text-[13px] font-semibold text-ink-primary mb-3">Add Manual Subscription</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Name</label>
              <input
                type="text"
                value={addDraft.merchant_name}
                onChange={(e) => setAddDraft((d) => ({ ...d, merchant_name: e.target.value }))}
                placeholder="e.g. Spotify"
                className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-ghost outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Amount</label>
              <input
                type="number"
                value={addDraft.amount}
                onChange={(e) => setAddDraft((d) => ({ ...d, amount: e.target.value }))}
                placeholder="9.99"
                step="0.01"
                min="0"
                className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-2 text-[13px] text-ink-primary font-mono placeholder:text-ink-ghost outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Frequency</label>
              <select
                value={addDraft.frequency}
                onChange={(e) => setAddDraft((d) => ({ ...d, frequency: e.target.value }))}
                className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-2 text-[13px] text-ink-primary outline-none focus:border-white/20"
              >
                {Object.entries(FREQ_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Category (optional)</label>
              <select
                value={addDraft.category}
                onChange={(e) => setAddDraft((d) => ({ ...d, category: e.target.value }))}
                className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-2 text-[13px] text-ink-primary outline-none focus:border-white/20"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAdd(false); setAddDraft({ merchant_name: "", amount: "", frequency: "monthly", category: "" }); }}
              className="hive-btn-ghost text-[12px] px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || !addDraft.merchant_name.trim() || !addDraft.amount}
              className="hive-btn-primary text-[12px] px-3 py-1.5 gap-1.5 disabled:opacity-40"
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add subscription
            </button>
          </div>
        </div>
      )}

      {/* Subscription list */}
      <div className="hive-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink-primary">Active Subscriptions</p>
          <p className="text-[11px] text-ink-tertiary">{subs.length} total</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center">
            <Repeat2 className="w-8 h-8 text-ink-tertiary/30 mx-auto mb-2" />
            <p className="text-[13px] text-ink-tertiary">No subscriptions detected yet.</p>
            <p className="text-[11px] text-ink-tertiary/60 mt-1">Run a sync to scan for recurring charges.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {subs.map((sub) => {
              const isEditing = editing === sub.id;
              const isDeleting = deleting === sub.id;
              const isConfirmDelete = confirmDelete === sub.id;

              return (
                <div
                  key={sub.id}
                  ref={(el) => { if (el) rowRefs.current.set(sub.id, el); else rowRefs.current.delete(sub.id); }}
                  className={cn("transition-all duration-700", highlightId === sub.id ? "bg-honey/[0.04]" : "")}
                >
                  {isEditing && editDraft ? (
                    /* ── Edit row ───────────────────────────────────── */
                    <div className="px-5 py-4 bg-white/[0.02] space-y-3">
                      <p className="text-[11px] font-semibold text-ink-ghost uppercase tracking-wide">Editing subscription</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3">
                          <label className="text-[10px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Name</label>
                          <input
                            type="text"
                            value={editDraft.merchant_name}
                            onChange={(e) => setEditDraft((d) => d ? { ...d, merchant_name: e.target.value } : d)}
                            className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-1.5 text-[13px] text-ink-primary outline-none focus:border-white/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Amount</label>
                          <input
                            type="number"
                            value={editDraft.amount}
                            onChange={(e) => setEditDraft((d) => d ? { ...d, amount: e.target.value } : d)}
                            step="0.01"
                            min="0"
                            className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-1.5 text-[13px] text-ink-primary font-mono outline-none focus:border-white/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Frequency</label>
                          <select
                            value={editDraft.frequency}
                            onChange={(e) => setEditDraft((d) => d ? { ...d, frequency: e.target.value } : d)}
                            className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-1.5 text-[13px] text-ink-primary outline-none focus:border-white/20"
                          >
                            {Object.entries(FREQ_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-ink-tertiary uppercase tracking-wide block mb-1">Category</label>
                          <select
                            value={editDraft.category}
                            onChange={(e) => setEditDraft((d) => d ? { ...d, category: e.target.value } : d)}
                            className="w-full bg-elevated border border-white/[0.07] rounded-lg px-3 py-1.5 text-[13px] text-ink-primary outline-none focus:border-white/20"
                          >
                            <option value="">— none —</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(sub.id)}
                          disabled={saving}
                          className="hive-btn-primary text-[12px] px-3 py-1.5 gap-1.5 disabled:opacity-40"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Save
                        </button>
                        <button onClick={cancelEdit} className="hive-btn-ghost text-[12px] px-3 py-1.5">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal row ─────────────────────────────────── */
                    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02]">
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center shrink-0">
                        <Repeat2 className="w-4 h-4 text-ink-tertiary" />
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-medium text-ink-primary truncate">{sub.merchant_name}</p>
                          {!sub.auto_detected && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-ghost bg-white/[0.05] px-1.5 py-0.5 rounded-full shrink-0">Manual</span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-tertiary">
                          {sub.category ?? "Unknown"} · {FREQ_LABELS[sub.frequency] ?? sub.frequency}
                          {sub.last_charged ? ` · Last: ${sub.last_charged}` : ""}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold font-mono text-ink-primary tabular-nums">
                          {fmt(sub.amount)}<span className="text-ink-tertiary text-[11px]">/{FREQ_SUFFIX[sub.frequency] ?? sub.frequency}</span>
                        </p>
                        <p className="text-[11px] text-ink-tertiary font-mono">
                          {fmt(annualCost(sub))}/yr
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5 ml-1 shrink-0">
                        {/* Edit */}
                        <button
                          onClick={() => startEdit(sub)}
                          className="p-1.5 rounded-lg text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.05] transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-[13px] h-[13px]" />
                        </button>

                        {/* Cancel subscription (mark inactive) */}
                        <button
                          onClick={() => handleCancel(sub.id)}
                          disabled={cancelling === sub.id}
                          className="p-1.5 rounded-lg text-ink-tertiary hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors disabled:opacity-40"
                          title="Mark as cancelled"
                        >
                          <X className="w-[13px] h-[13px]" />
                        </button>

                        {/* Delete */}
                        {isConfirmDelete ? (
                          <button
                            onClick={() => handleDelete(sub.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-semantic-expense bg-semantic-expense/[0.12] hover:bg-semantic-expense/[0.2] transition-colors disabled:opacity-40"
                            title="Confirm delete"
                          >
                            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete?"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(sub.id)}
                            className="p-1.5 rounded-lg text-ink-tertiary hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-[13px] h-[13px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
