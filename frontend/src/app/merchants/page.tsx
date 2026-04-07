"use client";

import { useEffect, useState } from "react";
import { api, MerchantSummary } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Store, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MONTH_ABBR: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function fmtMonth(ym: string) {
  const [, m] = ym.split("-");
  return MONTH_ABBR[m] ?? ym;
}

const CATEGORY_TAXONOMY: Record<string, string[]> = {
  "Food & Drink": ["Restaurant", "Fast Food", "Coffee", "Delivery", "Bar", "Groceries"],
  "Groceries": ["In-Store", "Online"],
  "Travel": ["Flights", "SW Flights", "Hotel", "Car Rental", "Rideshare", "Cruise"],
  "Transportation": ["Gas", "EV Charging", "Parking", "Tolls", "Transit", "Auto Service"],
  "Entertainment": ["Streaming", "Movies", "Events", "Gaming", "Sports"],
  "Shopping": ["General", "Clothing", "Electronics", "Amazon", "Home Goods"],
  "Health": ["Medical", "Pharmacy", "Gym", "Dental", "Vision"],
  "Utilities": ["Electric", "Internet", "Phone", "Water", "Insurance"],
  "Home": ["Rent", "Mortgage", "Furniture", "Repairs", "Garden"],
  "Education": ["Tuition", "Books", "Courses"],
  "Personal Care": ["Haircut", "Spa", "Clothing"],
  "Transfers": ["P2P", "Payment", "Refund"],
  "Business": ["Office", "Software", "Advertising"],
};

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<string | null>(null);
  const [detail, setDetail]       = useState<Awaited<ReturnType<typeof api.merchants.history>> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [days, setDays]           = useState(90);

  // Inline category editor state
  const [editingTxId, setEditingTxId]         = useState<string | null>(null);
  const [editCategory, setEditCategory]       = useState<string>("");
  const [editSubcategory, setEditSubcategory] = useState<string>("");
  const [savingTxId, setSavingTxId]           = useState<string | null>(null);
  const [bulkTaskId, setBulkTaskId]           = useState<string | null>(null);
  const [bulkStatus, setBulkStatus]           = useState<"idle" | "running" | "done" | "error">("idle");

  useEffect(() => {
    setLoading(true);
    api.merchants.list({ days, limit: 30 }).then(setMerchants).finally(() => setLoading(false));
  }, [days]);

  // Poll task status when bulkTaskId is set
  useEffect(() => {
    if (!bulkTaskId) return;
    const interval = setInterval(async () => {
      try {
        const s = await api.tasks.status(bulkTaskId);
        if (s.status === "SUCCESS") {
          setBulkStatus("done");
          setBulkTaskId(null);
          clearInterval(interval);
          setTimeout(() => setBulkStatus("idle"), 3000);
        } else if (s.status === "FAILURE") {
          setBulkStatus("error");
          setBulkTaskId(null);
          clearInterval(interval);
        }
      } catch { clearInterval(interval); }
    }, 1500);
    return () => clearInterval(interval);
  }, [bulkTaskId]);

  async function handleSelect(name: string) {
    setSelected(name);
    setEditingTxId(null);
    setEditCategory("");
    setEditSubcategory("");
    setBulkStatus("idle");
    setDetailLoading(true);
    try {
      const d = await api.merchants.history(name);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSaveCategory(txId: string) {
    setSavingTxId(txId);
    try {
      await api.transactions.updateCategory(txId, editCategory || "", editSubcategory || "");
      // Refresh detail
      if (selected) {
        const d = await api.merchants.history(selected);
        setDetail(d);
      }
      setEditingTxId(null);
    } finally {
      setSavingTxId(null);
    }
  }

  async function handleBulkRecategorize() {
    if (!selected || !editCategory) return;
    setBulkStatus("running");
    try {
      const result = await api.merchants.bulkRecategorize(selected, editCategory, editSubcategory || null);
      setBulkTaskId(result.task_id);
      // Refresh detail immediately (categories updated in DB)
      const d = await api.merchants.history(selected);
      setDetail(d);
    } catch {
      setBulkStatus("error");
    }
  }

  if (selected && detail) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="pointer-events-none fixed top-0 left-56 w-96 h-96 rounded-full opacity-[0.06] blur-[80px]"
             style={{ background: "#38BDF8" }} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelected(null); setDetail(null); }}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">{detail.merchant_name}</h1>
            <p className="text-[13px] text-ink-tertiary">{detail.transaction_count} transactions · {fmt(detail.total_spent)} total</p>
          </div>
        </div>

        {/* Monthly chart */}
        {detail.monthly.length > 0 && (
          <GlassCard tint="sky" className="p-5">
            <p className="text-[13px] font-medium text-ink-primary mb-4">Monthly Spend</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={detail.monthly.map((m) => ({ ...m, month: fmtMonth(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#6B6B73", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B6B73", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1A1A1D", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#F5F5F7", fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), "Spent"]}
                />
                <Bar dataKey="total" fill="#F5B942" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}

        {/* Bulk recategorize */}
        {detail.transactions.length > 1 && (
          <GlassCard className="p-4">
            <p className="text-[12px] font-medium text-ink-primary mb-3">
              Apply category to all {detail.transaction_count} transactions from this merchant
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={editCategory}
                onChange={e => { setEditCategory(e.target.value); setEditSubcategory(""); }}
                className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-1.5 text-ink-primary"
              >
                <option value="">— category —</option>
                {Object.keys(CATEGORY_TAXONOMY).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {editCategory && (
                <select
                  value={editSubcategory}
                  onChange={e => setEditSubcategory(e.target.value)}
                  className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-1.5 text-ink-primary"
                >
                  <option value="">— subcategory —</option>
                  {(CATEGORY_TAXONOMY[editCategory] ?? []).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleBulkRecategorize}
                disabled={!editCategory || bulkStatus === "running"}
                className="text-[12px] px-3 py-1.5 rounded-lg bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
              >
                {bulkStatus === "running" ? "Applying…" : "Apply to All"}
              </button>
              {bulkStatus === "running" && (
                <span className="text-[11px] text-ink-tertiary flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Recalculating points…
                </span>
              )}
              {bulkStatus === "done" && (
                <span className="text-[11px] text-semantic-income">✓ Points recalculated</span>
              )}
              {bulkStatus === "error" && (
                <span className="text-[11px] text-semantic-expense">Error — try again</span>
              )}
            </div>
          </GlassCard>
        )}

        {/* Transaction list */}
        <GlassCard className="overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-[13px] font-medium text-ink-primary">All Transactions</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {detail.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ink-secondary">{t.date}</p>

                  {editingTxId === t.id ? (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <select
                        value={editCategory}
                        onChange={e => { setEditCategory(e.target.value); setEditSubcategory(""); }}
                        className="text-[11px] bg-elevated border border-white/[0.08] rounded px-2 py-0.5 text-ink-primary"
                      >
                        <option value="">— category —</option>
                        {Object.keys(CATEGORY_TAXONOMY).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {editCategory && (
                        <select
                          value={editSubcategory}
                          onChange={e => setEditSubcategory(e.target.value)}
                          className="text-[11px] bg-elevated border border-white/[0.08] rounded px-2 py-0.5 text-ink-primary"
                        >
                          <option value="">— subcategory —</option>
                          {(CATEGORY_TAXONOMY[editCategory] ?? []).map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => handleSaveCategory(t.id)}
                        disabled={savingTxId === t.id}
                        className="text-[10px] px-2 py-0.5 rounded bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40"
                      >
                        {savingTxId === t.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingTxId(null)}
                        className="text-[10px] px-2 py-0.5 rounded hover:bg-white/[0.05] text-ink-tertiary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingTxId(t.id);
                        setEditCategory(t.category ?? "");
                        setEditSubcategory(t.subcategory ?? "");
                      }}
                      className="text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors text-left group"
                    >
                      {t.category ?? "—"}{t.subcategory ? ` · ${t.subcategory}` : ""}
                      <span className="ml-1 opacity-0 group-hover:opacity-100 text-honey">✎</span>
                    </button>
                  )}
                </div>
                <p className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums shrink-0">{fmt(t.amount)}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Sky ambient glow */}
      <div className="pointer-events-none fixed top-0 left-56 w-96 h-96 rounded-full opacity-[0.06] blur-[80px]"
           style={{ background: "#38BDF8" }} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Merchants</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">Top merchants by spend</p>
        </div>
        <div className="flex items-center gap-1 bg-elevated rounded-lg p-1">
          {[30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "px-3 py-1 rounded-md text-[11px] font-medium transition-colors",
                days === d ? "bg-white/[0.08] text-ink-primary" : "text-ink-tertiary hover:text-ink-secondary"
              )}
            >
              {d === 365 ? "1yr" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      <GlassCard tint="sky" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {merchants.map((m, i) => (
              <button
                key={m.merchant_name}
                onClick={() => handleSelect(m.merchant_name)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/[0.05] text-[11px] font-bold text-ink-tertiary shrink-0">
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-primary truncate">{m.merchant_name}</p>
                  <p className="text-[11px] text-ink-tertiary">
                    {m.transaction_count} transactions · avg {fmt(m.avg_amount)}
                    {m.category ? ` · ${m.category}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-semibold font-mono text-ink-primary tabular-nums">{fmt(m.total_spent)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-tertiary/40 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
