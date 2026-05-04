"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, Budget, Transaction } from "@/lib/api";
import { fmt, currentMonth, monthLabel, previousMonth, ALL_CATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, X, ChevronDown, ChevronRight, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { MonthPicker } from "@/components/MonthPicker";
import { toast } from "@/components/Toast";
import { Sparkline } from "@/components/Sparkline";
import { PageHero } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";

const SUBCATEGORIES: Record<string, string[]> = {
  "Food & Drink":   ["Restaurant", "Fast Food", "Coffee", "Delivery", "Bar"],
  "Groceries":      ["In-Store", "Online"],
  "Travel":         ["Flights", "SW Flights", "Hotel", "Car Rental", "Rideshare", "Cruise"],
  "Transportation": ["Gas", "EV Charging", "Parking", "Tolls", "Transit", "Auto Service"],
  "Entertainment":  ["Streaming", "Movies", "Events", "Gaming", "Sports"],
  "Shopping":       ["General", "Clothing", "Electronics", "Amazon", "Home Goods"],
  "Health":         ["Medical", "Pharmacy", "Gym", "Dental", "Vision"],
  "Utilities":      ["Electric", "Internet", "Phone", "Water", "Insurance"],
  "Home":           ["Rent", "Mortgage", "Furniture", "Repairs"],
  "Education":      ["Tuition", "Books", "Courses"],
  "Personal Care":  ["Haircut", "Spa"],
  "Transfers":      ["P2P", "Payment", "Refund"],
  "Business":       ["Office", "Software", "Advertising"],
};

interface RecatState {
  txId: string;
  category: string;
  subcategory: string;
  saving: boolean;
}

// ── Budget Card ────────────────────────────────────────────────────────────

function BudgetCard({
  b,
  index,
  month,
  onUpdate,
  onDelete,
  onTxRecategorized,
  highlighted = false,
}: {
  b: Budget;
  index: number;
  month: string;   // YYYY-MM
  onUpdate: (b: Budget) => void;
  onDelete: (id: string) => void;
  onTxRecategorized: () => void;
  highlighted?: boolean;
}) {
  const [editing, setEditing]           = useState(false);
  const router = useRouter();
  const [value, setValue]               = useState(String(b.budget_amount));
  const [rollover, setRollover]         = useState(b.rollover);
  const [togglingRollover, setTogglingRollover] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);

  // Drill-down state
  const [expanded, setExpanded]         = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [recat, setRecat]               = useState<RecatState | null>(null);
  // Sparkline data
  const [trendData, setTrendData]       = useState<number[]>([]);
  // Ref for scroll-into-view when highlighted
  const cardRef = useRef<HTMLDivElement>(null);

  const effectiveBudget = b.effective_budget || b.budget_amount;
  const isOver    = b.pct_used > 100;
  const isWarning = b.pct_used > 80 && !isOver;
  const barColor  = isOver
    ? "linear-gradient(90deg, #F87171, #EF4444)"
    : isWarning
    ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
    : "linear-gradient(90deg, #34D399, #10B981)";
  const pctColor  = isOver ? "text-semantic-expense" : isWarning ? "text-honey" : "text-semantic-income";
  const barPct    = Math.min(b.pct_used, 100);

  async function save() {
    const amt = parseFloat(value);
    if (isNaN(amt) || amt < 0) return;
    setSaving(true);
    try {
      const monthStr = b.month.substring(0, 7);
      const updated  = await api.budgets.upsert(b.category, monthStr, amt, rollover);
      onUpdate(updated);
      setEditing(false);
      toast.success("Budget updated");
    } catch {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRollover() {
    setTogglingRollover(true);
    const next = !rollover;
    setRollover(next);
    try {
      const monthStr = b.month.substring(0, 7);
      const updated = await api.budgets.upsert(b.category, monthStr, b.budget_amount, next);
      onUpdate(updated);
    } catch {
      setRollover(!next); // revert on error
      toast.error("Failed to update rollover setting");
    } finally {
      setTogglingRollover(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.budgets.delete(b.id);
      onDelete(b.id);
      toast.success(`Removed ${b.category} budget`);
    } catch {
      toast.error("Failed to delete budget");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    api.cashFlow.categoryTrend(b.category, 6)
      .then((rows) => setTrendData(rows.map((r) => r.total)))
      .catch(() => {});
  }, [b.category]);

  // Auto-scroll and auto-expand when deep-linked from insights
  useEffect(() => {
    if (!highlighted) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setExpanded(true);
  }, [highlighted]);

  const loadTransactions = useCallback(async () => {
    setDrillLoading(true);
    try {
      const resp = await api.transactions.list({
        month,
        category: b.category,
        page_size: 100,
      });
      setTransactions(resp.items);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setDrillLoading(false);
    }
  }, [month, b.category]);

  async function toggleExpanded() {
    if (expanded) {
      setExpanded(false);
      setRecat(null);
      return;
    }
    setExpanded(true);
    await loadTransactions();
  }

  async function saveRecat() {
    if (!recat) return;
    setRecat(r => r ? { ...r, saving: true } : r);
    try {
      await api.transactions.updateCategory(recat.txId, recat.category, recat.subcategory);
      await loadTransactions();
      setRecat(null);
      onTxRecategorized();
      toast.success("Transaction recategorized");
    } catch {
      toast.error("Failed to recategorize transaction");
      setRecat(r => r ? { ...r, saving: false } : r);
    }
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "border-b border-white/[0.04] last:border-0 transition-colors",
        isOver && "border-l-2 border-l-semantic-expense",
        highlighted && "ring-1 ring-inset ring-honey/30 bg-honey/[0.02]",
      )}
    >
      {/* Main row */}
      <div className="px-5 py-4 hover:bg-white/[0.015] transition-colors">
        <div className="flex items-center gap-3">
          {/* Expand toggle */}
          <button
            onClick={toggleExpanded}
            className="text-ink-ghost hover:text-ink-tertiary transition-colors shrink-0 mt-0.5"
            aria-label="Show transactions"
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
          </button>

          {/* Category + bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-ink-primary">{b.category}</span>
                {b.rollover && b.rollover_amount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 tabular-nums">
                    +{fmt(b.rollover_amount)} rollover
                  </span>
                )}
                {trendData.length >= 2 && (
                  <span title="6-month spending trend">
                    <Sparkline
                      data={trendData}
                      width={56}
                      height={20}
                      color={isOver ? "#ef4444" : isWarning ? "#F5B942" : "#2d9e72"}
                    />
                  </span>
                )}
              </div>
              <span className={cn("text-[11px] font-mono font-semibold tabular-nums", pctColor)}>
                {b.pct_used.toFixed(0)}%
              </span>
            </div>
            <AnimatedBar pct={barPct} color={barColor} height={4} delay={index * 60} />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] font-mono text-ink-tertiary/60 tabular-nums">
                {fmt(b.actual_spend)} of {fmt(effectiveBudget)}
                {b.rollover && b.rollover_amount > 0 && (
                  <span className="text-ink-ghost/50"> ({fmt(b.budget_amount)} base)</span>
                )}
              </span>
              <span className={cn("text-[10px] font-mono tabular-nums", b.remaining >= 0 ? "text-ink-tertiary/50" : "text-semantic-expense/70")}>
                {b.remaining >= 0 ? `${fmt(b.remaining)} left` : `${fmt(Math.abs(b.remaining))} over`}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-[12px] text-ink-tertiary">$</span>
                <input
                  type="number" value={value} onChange={(e) => setValue(e.target.value)}
                  className="w-16 bg-elevated border border-white/[0.1] rounded-lg px-2 py-1 text-[12px]
                             text-ink-primary focus:outline-none focus:border-honey/40"
                  onKeyDown={(e) => e.key === "Enter" && save()} autoFocus
                />
                <button onClick={save} disabled={saving}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-honey bg-honey/[0.10]
                             hover:bg-honey/[0.2] disabled:opacity-40 transition-colors">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditing(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-ink-tertiary hover:bg-white/[0.06] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-semantic-expense">Remove?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-[10px] bg-semantic-expense/10 border border-semantic-expense/20 text-semantic-expense
                             px-2 py-0.5 rounded-lg hover:bg-semantic-expense/20 disabled:opacity-40 transition-colors">
                  {deleting ? "…" : "Yes"}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-ink-tertiary hover:bg-white/[0.06] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={toggleRollover}
                  disabled={togglingRollover}
                  title={rollover ? "Rollover enabled — unspent carries forward" : "Enable rollover"}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded border transition-colors",
                    rollover
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      : "border-white/[0.06] text-ink-ghost hover:text-ink-tertiary hover:border-white/[0.12]"
                  )}
                >
                  ↻
                </button>
                <button onClick={() => setEditing(true)}
                  className="text-[11px] text-honey/60 hover:text-honey transition-colors px-2 py-1 rounded-lg hover:bg-honey/[0.06]">
                  Edit
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-ink-tertiary/40
                             hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Drill-down transactions */}
      {expanded && (
        <div className="bg-black/[0.15] border-t border-white/[0.04]">
          {drillLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-ink-tertiary text-[12px]">
              <Loader2 size={13} className="animate-spin" />
              <span>Loading transactions…</span>
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-5 text-center text-[12px] text-ink-tertiary">
              No transactions in {b.category} this month.
            </p>
          ) : (
            <div>
              <div className="px-8 py-2 flex items-center justify-between border-b border-white/[0.04]">
                <p className="text-[10px] text-ink-tertiary uppercase tracking-wide">
                  {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} · {b.category}
                </p>
              </div>
              {transactions.map((tx) => {
                const isRecatting = recat?.txId === tx.id;
                return (
                  <div
                    key={tx.id}
                    className={cn(
                      "px-8 py-2.5 border-b border-white/[0.03] last:border-0",
                      isRecatting ? "bg-honey/[0.04]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    {!isRecatting ? (
                      <div className="flex items-center gap-3">
                        <p className="text-[11px] text-ink-tertiary w-14 shrink-0 tabular-nums">{tx.date}</p>
                        <p className="text-[12px] text-ink-primary flex-1 truncate">
                          {tx.merchant || tx.raw_description}
                        </p>
                        <p className="text-[11px] text-ink-tertiary shrink-0">
                          {tx.category}{tx.subcategory ? ` / ${tx.subcategory}` : ""}
                        </p>
                        <p className="text-[13px] font-mono font-medium text-ink-primary tabular-nums w-18 text-right shrink-0">
                          {fmt(tx.amount)}
                        </p>
                        <button
                          onClick={() => setRecat({ txId: tx.id, category: tx.category ?? "", subcategory: tx.subcategory ?? "", saving: false })}
                          className="text-[10px] text-ink-ghost hover:text-honey transition-colors shrink-0 px-1.5 py-0.5 rounded border border-white/[0.06] hover:border-honey/30"
                        >
                          Recategorize
                        </button>
                        <button
                          onClick={() => router.push(`/transactions?open_tx=${tx.id}&search_all=true${tx.merchant ? `&search=${encodeURIComponent(tx.merchant)}` : ""}`)}
                          className="text-ink-ghost hover:text-honey transition-colors shrink-0 p-0.5"
                          title="View in transactions"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-[11px] text-ink-tertiary w-14 shrink-0">{tx.date}</p>
                          <p className="text-[12px] text-ink-primary flex-1 truncate">
                            {tx.merchant || tx.raw_description}
                          </p>
                          <p className="text-[13px] font-mono font-medium text-ink-primary tabular-nums">
                            {fmt(tx.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pl-[68px]">
                          <select
                            value={recat?.category ?? ""}
                            onChange={(e) => setRecat(r => r ? { ...r, category: e.target.value, subcategory: "" } : r)}
                            className="hive-select text-[11px] py-1 px-2 h-7"
                          >
                            <option value="">— category —</option>
                            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select
                            value={recat?.subcategory ?? ""}
                            onChange={(e) => setRecat(r => r ? { ...r, subcategory: e.target.value } : r)}
                            className="hive-select text-[11px] py-1 px-2 h-7"
                            disabled={!recat?.category}
                          >
                            <option value="">— subcategory —</option>
                            {(SUBCATEGORIES[recat?.category ?? ""] ?? []).map(s =>
                              <option key={s} value={s}>{s}</option>
                            )}
                          </select>
                          <button
                            onClick={saveRecat}
                            disabled={!recat?.category || recat.saving}
                            className="hive-btn-primary text-[11px] h-7 px-3 gap-1"
                          >
                            {recat?.saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            Save
                          </button>
                          <button
                            onClick={() => setRecat(null)}
                            className="hive-btn-ghost text-[11px] h-7 px-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function BudgetsPageInner() {
  const searchParams = useSearchParams();
  const highlightCategory = searchParams.get("category") ?? null;
  const [month, setMonth]             = useState(() => searchParams.get("month") ?? currentMonth());
  const [budgets, setBudgets]         = useState<Budget[]>([]);
  const [loading, setLoading]         = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount]     = useState("");
  const [adding, setAdding]           = useState(false);
  const [suggesting, setSuggesting]   = useState(false);
  const [suggestion, setSuggestion]   = useState<{ avg: number; suggested: number } | null>(null);
  const [copying, setCopying]         = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.budgets.list(month);
      setBudgets(data);
    } catch {
      toast.error("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [month]);

  function handleUpdate(updated: Budget) {
    setBudgets((prev) => prev.map((b) => b.id === updated.id ? updated : b));
  }

  function handleDelete(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  async function addBudget() {
    const cat = newCategory.trim();
    const amt = parseFloat(newAmount);
    if (!cat || isNaN(amt) || amt <= 0) return;
    setAdding(true);
    try {
      const b = await api.budgets.upsert(cat, month, amt);
      setBudgets((prev) => {
        const exists = prev.find((x) => x.id === b.id);
        return exists
          ? prev.map((x) => x.id === b.id ? b : x)
          : [...prev, b].sort((a, c) => b.actual_spend > 0 ? -1 : a.category.localeCompare(c.category));
      });
      setNewCategory("");
      setNewAmount("");
      toast.success(`Budget added for ${cat}`);
    } catch {
      toast.error("Failed to add budget");
    } finally {
      setAdding(false);
    }
  }

  async function copyFromPreviousMonth() {
    const prevMo = previousMonth();
    setCopying(true);
    try {
      const result = await api.budgets.copy(prevMo, month);
      if (result.copied > 0) {
        toast.success(`Copied ${result.copied} budget${result.copied !== 1 ? "s" : ""} from ${monthLabel(prevMo)}`);
        await load();
      } else {
        toast.warning(`No budgets found in ${monthLabel(prevMo)}`);
      }
    } catch {
      toast.error("Copy failed — try again");
    } finally {
      setCopying(false);
    }
  }

  const months: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.budget_amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.actual_spend, 0);
  const remaining     = totalBudgeted - totalSpent;
  const onTrackCount  = budgets.filter((b) => b.pct_used <= 80).length;
  const currentMonthLabel = monthLabel(month);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow={`Budgets · ${currentMonthLabel}`}
            headline={
              budgets.length > 0 ? (
                <>
                  <span className="text-semantic-income">{onTrackCount}</span>
                  <span className="text-ink-tertiary text-[28px] font-semibold">/{budgets.length}</span>
                </>
              ) : (
                <span className="text-ink-secondary">—</span>
              )
            }
            subtext={budgets.length > 0 ? "budgets on track this month" : "no budgets set for this month"}
            statStrip={budgets.length > 0 ? [
              { label: "Total Budgeted",    value: fmt(totalBudgeted),          color: "default" },
              { label: "Total Spent",       value: fmt(totalSpent),              color: totalSpent > totalBudgeted ? "red" : "default" },
              { label: "Savings Available", value: fmt(Math.max(remaining, 0)), color: remaining >= 0 ? "green" : "red" },
            ] : undefined}
          />
        </div>
        <div className="flex items-center gap-2 md:mt-2 shrink-0 px-4 md:px-0">
          {budgets.length > 0 && (
            <button
              onClick={copyFromPreviousMonth}
              disabled={copying}
              className="hive-btn-secondary text-[11px] py-1 px-2.5 gap-1"
              title={`Copy all budgets from ${monthLabel(previousMonth())}`}
            >
              {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {copying ? "Copying…" : "Copy last month"}
            </button>
          )}
          <MonthPicker month={month} onChange={setMonth} maxMonth={currentMonth()} />
        </div>
      </div>
      {/* ── Add Budget ──────────────────────────────────────────────── */}
      <div className="hive-card p-5">
        <p className="hive-label mb-4">Add Budget</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[11px] text-ink-tertiary mb-1.5 tracking-wide">Category</label>
            <select
              value={newCategory}
              onChange={(e) => { setNewCategory(e.target.value); setSuggestion(null); }}
              className="hive-select w-48 text-[13px]"
            >
              <option value="">Select category…</option>
              {ALL_CATEGORIES.filter((c) => c !== "Transfers" && c !== "Uncategorized").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-ink-tertiary mb-1.5 tracking-wide">Monthly Budget ($)</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="500"
              className="bg-elevated border border-white/[0.08] rounded-xl px-3 py-2 text-[12px]
                         text-ink-primary w-28 focus:outline-none focus:border-honey/40 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && newCategory && addBudget()}
            />
          </div>
          <button
            onClick={async () => {
              if (!newCategory) return;
              setSuggesting(true);
              try {
                const results = await api.budgets.suggest(month);
                const match = results.find((r) => r.category === newCategory);
                if (match) setSuggestion({ avg: match.avg_monthly, suggested: match.suggested_budget });
                else setSuggestion({ avg: 0, suggested: 0 });
              } catch {
                toast.error("Failed to fetch budget suggestion");
              } finally {
                setSuggesting(false);
              }
            }}
            disabled={suggesting || !newCategory}
            className="hive-btn-secondary py-2"
            title="Suggest budget based on history"
          >
            {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {suggesting ? "…" : "Suggest"}
          </button>
          <button
            onClick={addBudget}
            disabled={adding || !newCategory.trim() || !newAmount}
            className="hive-btn-primary py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            {adding ? "Adding…" : "Add Budget"}
          </button>
        </div>
        {suggestion && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-honey/[0.05] border border-honey/[0.12]">
            {suggestion.avg > 0 ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-honey shrink-0" />
                <span className="text-[12px] text-ink-secondary">
                  3-mo avg <span className="text-ink-primary font-medium font-mono">{fmt(suggestion.avg)}</span>
                  {" · "}suggested <span className="text-honey font-semibold font-mono">{fmt(suggestion.suggested)}</span>
                </span>
                <button
                  onClick={() => { setNewAmount(String(suggestion.suggested)); setSuggestion(null); }}
                  className="ml-auto text-[11px] text-honey font-medium hover:text-honey/80 transition-colors"
                >
                  Use
                </button>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
                <span className="text-[12px] text-ink-tertiary">No spending history for {newCategory}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Budget List ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="hive-card overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-white/[0.04] last:border-0 animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="h-2.5 bg-white/[0.08] rounded w-24" />
                <div className="h-2 bg-white/[0.06] rounded w-8" />
              </div>
              <div className="h-1 bg-white/[0.06] rounded-full" />
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="hive-card px-5 py-12 text-center">
          <p className="text-[13px] text-ink-secondary mb-1">No budgets for {monthLabel(month)}</p>
          <p className="text-[12px] text-ink-tertiary mb-5">Add one above, or copy last month&apos;s budgets.</p>
          <button
            onClick={copyFromPreviousMonth}
            disabled={copying}
            className="hive-btn-secondary text-[12px] px-4 py-2 gap-2"
          >
            {copying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {copying ? "Copying…" : `Copy from ${monthLabel(previousMonth())}`}
          </button>
        </div>
      ) : (
        <div className="hive-card overflow-hidden">
          {budgets.map((b, index) => (
            <BudgetCard
              key={b.id}
              b={b}
              index={index}
              month={month}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onTxRecategorized={load}
              highlighted={highlightCategory === b.category}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Suspense>
      <BudgetsPageInner />
    </Suspense>
  );
}
