"use client";

import { useState, useEffect, useCallback } from "react";
import { api, MbaSummary, Loan } from "@/lib/api";
import { toast } from "@/components/Toast";
import { fmt, cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";
import { Plus, Trash2, GraduationCap } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function monthOptions(): string[] {
  const opts: string[] = [];
  let m = "2025-08";
  while (m <= "2029-12") {
    opts.push(m);
    m = addMonths(m, 1);
  }
  return opts;
}

const MONTH_OPTIONS = monthOptions();

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MbaBudgetPage() {
  const [startMonth, setStartMonth] = useState("2026-08");
  const [endMonth, setEndMonth] = useState(addMonths("2026-08", 23));
  const [summary, setSummary] = useState<MbaSummary | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  const [addingLoan, setAddingLoan] = useState(false);
  const [newLoanName, setNewLoanName] = useState("");
  const [savingLoan, setSavingLoan] = useState(false);

  const [entryFormLoanId, setEntryFormLoanId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<"disbursement" | "payment" | "interest">("disbursement");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingEntry, setSavingEntry] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.mba.summary(startMonth, endMonth),
      api.loans.list(),
    ]).then(([sumR, loansR]) => {
      if (sumR.status === "fulfilled") setSummary(sumR.value);
      else toast.error("Failed to load MBA budget summary");
      if (loansR.status === "fulfilled") setLoans(loansR.value);
      else toast.error("Failed to load loans");
    }).finally(() => setLoading(false));
  }, [startMonth, endMonth]);

  useEffect(() => { load(); }, [load]);

  async function handleAddLoan() {
    if (!newLoanName.trim()) return;
    setSavingLoan(true);
    try {
      await api.loans.create({ name: newLoanName.trim() });
      setNewLoanName("");
      setAddingLoan(false);
      toast.success("Loan added");
      load();
    } catch {
      toast.error("Failed to add loan");
    } finally {
      setSavingLoan(false);
    }
  }

  async function handleDeleteLoan(id: string) {
    try {
      await api.loans.delete(id);
      toast.success("Loan removed");
      load();
    } catch {
      toast.error("Failed to remove loan");
    }
  }

  async function handleAddEntry() {
    const amt = parseFloat(entryAmount);
    if (!entryFormLoanId || !amt || amt <= 0) return;
    setSavingEntry(true);
    try {
      await api.loans.addEntry(entryFormLoanId, {
        entry_type: entryType,
        amount: amt,
        entry_date: entryDate,
      });
      setEntryFormLoanId(null);
      setEntryAmount("");
      toast.success("Entry saved");
      load();
    } catch {
      toast.error("Failed to save entry");
    } finally {
      setSavingEntry(false);
    }
  }

  const totalLoanBalance = loans.reduce((sum, l) => sum + l.balance, 0);

  return (
    <div className="space-y-6">
      <PageHero
        title="MBA Budget"
        subtitle="Tuition, living costs, and loan balances for the program"
        glow="violet"
        stats={
          totalLoanBalance > 0
            ? [{ label: "Total loan balance", value: fmt(totalLoanBalance), color: "warning" }]
            : undefined
        }
      />

      {/* ── Loans ─────────────────────────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-ink-primary flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-ink-tertiary" />
            Loans
          </h2>
          <button
            onClick={() => setAddingLoan(true)}
            className="flex items-center gap-1 text-[11px] text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add loan
          </button>
        </div>

        {loans.length === 0 && !addingLoan && (
          <p className="text-[12px] text-ink-tertiary">No loans tracked yet. Add one to log disbursements and payments.</p>
        )}

        <div className="space-y-3">
          {loans.map((loan) => (
            <div key={loan.id} className="border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-ink-primary">{loan.name}</p>
                  <p className="text-[11px] text-ink-tertiary">
                    Disbursed {fmt(loan.total_disbursed)} · Paid {fmt(loan.total_paid)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-semibold text-ink-primary">{fmt(loan.balance)}</span>
                  <button
                    onClick={() => setEntryFormLoanId(entryFormLoanId === loan.id ? null : loan.id)}
                    className="text-[11px] text-honey hover:text-honey/80 transition-colors"
                  >
                    + Entry
                  </button>
                  <button
                    onClick={() => handleDeleteLoan(loan.id)}
                    className="text-ink-ghost hover:text-semantic-expense transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {entryFormLoanId === loan.id && (
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-end gap-2">
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as typeof entryType)}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary"
                  >
                    <option value="disbursement">Disbursement</option>
                    <option value="payment">Payment</option>
                    <option value="interest">Interest accrual</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    className="w-28 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary"
                  />
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary"
                  />
                  <button
                    onClick={handleAddEntry}
                    disabled={savingEntry || !entryAmount}
                    className="py-1.5 px-3 rounded-lg bg-honey/[0.12] border border-honey/25 text-honey text-[11px] font-semibold hover:bg-honey/[0.18] transition-colors disabled:opacity-50"
                  >
                    {savingEntry ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          ))}

          {addingLoan && (
            <div className="border border-white/[0.06] rounded-xl p-3 flex items-center gap-2">
              <input
                autoFocus
                placeholder="Loan name (e.g. Federal Direct Loan)"
                value={newLoanName}
                onChange={(e) => setNewLoanName(e.target.value)}
                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary"
              />
              <button
                onClick={handleAddLoan}
                disabled={savingLoan || !newLoanName.trim()}
                className="py-1.5 px-3 rounded-lg bg-honey/[0.12] border border-honey/25 text-honey text-[11px] font-semibold hover:bg-honey/[0.18] transition-colors disabled:opacity-50"
              >
                {savingLoan ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setAddingLoan(false); setNewLoanName(""); }}
                className="text-[11px] text-ink-tertiary hover:text-ink-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Month range ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <select
          value={startMonth}
          onChange={(e) => setStartMonth(e.target.value)}
          className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary"
        >
          {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <span className="text-[12px] text-ink-tertiary">to</span>
        <select
          value={endMonth}
          onChange={(e) => setEndMonth(e.target.value)}
          className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary"
        >
          {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* ── Monthly plan vs actual ───────────────────────────────────────── */}
      <GlassCard className="p-5 overflow-x-auto">
        {loading ? (
          <p className="text-[12px] text-ink-tertiary">Loading…</p>
        ) : !summary || summary.months.length === 0 ? (
          <p className="text-[12px] text-ink-tertiary">No data for this range.</p>
        ) : (
          <table className="w-full text-[12px] min-w-[720px]">
            <thead>
              <tr className="text-ink-tertiary text-left border-b border-white/[0.06]">
                <th className="py-2 pr-3 font-medium">Month</th>
                {summary.months[0].lines.map((l) => (
                  <th key={l.category} className="py-2 px-3 font-medium text-right">{l.label}</th>
                ))}
                <th className="py-2 pl-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((month) => (
                <tr key={month.month} className="border-b border-white/[0.03]">
                  <td className="py-2 pr-3 text-ink-secondary">
                    {monthLabel(month.month)}
                    {month.month === todayMonth() && (
                      <span className="ml-1.5 text-[10px] text-honey">now</span>
                    )}
                  </td>
                  {month.lines.map((line) => (
                    <td key={line.category} className="py-2 px-3 text-right">
                      {line.actual !== null ? (
                        <span className={cn(
                          "font-medium",
                          line.planned > 0 && line.actual > line.planned ? "text-semantic-expense" : "text-ink-primary"
                        )}>
                          {fmt(line.actual)}
                        </span>
                      ) : (
                        <span className="text-ink-ghost">—</span>
                      )}
                      {line.planned > 0 && (
                        <span className="text-ink-ghost ml-1">/ {fmt(line.planned)}</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right font-semibold text-ink-primary">
                    {month.total_actual !== null ? fmt(month.total_actual) : "—"}
                    {month.total_planned > 0 && (
                      <span className="text-ink-ghost font-normal ml-1">/ {fmt(month.total_planned)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[10px] text-ink-ghost mt-3">Actual / Planned. Planned comes from Budgets for Education, Home, Groceries, Food &amp; Drink, Entertainment, and Travel.</p>
      </GlassCard>
    </div>
  );
}
