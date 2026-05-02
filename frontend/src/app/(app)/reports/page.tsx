"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, SpendByCategory, SpendByCard, Transaction, Account } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Download, ChevronDown, ChevronRight, Loader2, X, Check, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { toast } from "@/components/Toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ComposedChart, Line,
} from "recharts";
import { GlassCard } from "@/components/GlassCard";
import { FilterPills } from "@/components/FilterPills";
import { PageHero } from "@/components/PageHero";

type ReportType = "category" | "monthly" | "yoy" | "weekday" | "budget-history" | "calendar" | "card" | "merchants";
type CatPeriod = "this-month" | "last-month" | "last-3" | "last-6" | "ytd" | "full-year" | "custom";

const CAT_PERIOD_OPTIONS: { label: string; value: CatPeriod }[] = [
  { label: "This Month",   value: "this-month"  },
  { label: "Last Month",   value: "last-month"  },
  { label: "Last 3 Mo",    value: "last-3"      },
  { label: "Last 6 Mo",    value: "last-6"      },
  { label: "YTD",          value: "ytd"         },
  { label: "Full Year",    value: "full-year"   },
  { label: "Custom",       value: "custom"      },
];

function getPeriodDates(period: CatPeriod, year: number, customStart: string, customEnd: string): { start: string; end: string; label: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (period === "this-month") {
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { start, end: today, label: `${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}` };
  }
  if (period === "last-month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const start = d.toISOString().slice(0, 10);
    return { start, end: end.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  if (period === "last-3") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { start: start.toISOString().slice(0, 10), end: today, label: "Last 3 Months" };
  }
  if (period === "last-6") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return { start: start.toISOString().slice(0, 10), end: today, label: "Last 6 Months" };
  }
  if (period === "ytd") {
    return { start: `${now.getFullYear()}-01-01`, end: today, label: `YTD ${now.getFullYear()}` };
  }
  if (period === "custom") {
    return { start: customStart, end: customEnd, label: `${customStart} – ${customEnd}` };
  }
  // full-year
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
}

/** Get the equivalent prior period dates for comparison (same duration, immediately before). */
function getPriorPeriodDates(period: CatPeriod, year: number, customStart: string, customEnd: string): { start: string; end: string } | null {
  const now = new Date();

  if (period === "this-month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: d.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "last-month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    return { start: d.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "last-3") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - 3, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "last-6") {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - 6, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "ytd") {
    return { start: `${now.getFullYear() - 1}-01-01`, end: `${now.getFullYear() - 1}-12-31` };
  }
  if (period === "full-year") {
    return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
  }
  if (period === "custom" && customStart && customEnd) {
    const startMs = new Date(customStart).getTime();
    const endMs   = new Date(customEnd).getTime();
    const duration = endMs - startMs;
    const priorEnd   = new Date(startMs - 1);
    const priorStart = new Date(startMs - 1 - duration);
    return { start: priorStart.toISOString().slice(0, 10), end: priorEnd.toISOString().slice(0, 10) };
  }
  return null;
}

interface MonthlyRow {
  month: string;
  expenses: number;
  income: number;
  net: number;
  expense_count: number;
}


const REPORT_OPTIONS = [
  { label: "By Category",    value: "category"       },
  { label: "Top Merchants",  value: "merchants"      },
  { label: "By Card",        value: "card"           },
  { label: "Monthly",        value: "monthly"        },
  { label: "Calendar",       value: "calendar"       },
  { label: "Year-over-Year", value: "yoy"            },
  { label: "By Day of Week", value: "weekday"        },
  { label: "Budget History", value: "budget-history" },
];

const CATEGORIES = [
  "Food & Drink", "Groceries", "Travel", "Transportation", "Entertainment",
  "Shopping", "Health", "Utilities", "Home", "Education", "Personal Care",
  "Business", "Income", "Transfers", "Uncategorized",
];

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
  "Income":         ["Salary", "Freelance", "Interest", "Dividend", "Tax Refund", "Bonus", "Other"],
  "Transfers":      ["P2P", "Payment", "Refund"],
  "Business":       ["Office", "Software", "Advertising"],
};

interface DrillState {
  key: string;         // "category|subcategory" — unique per row
  category: string;
  subcategory: string | null;
  transactions: Transaction[];
  loading: boolean;
}

interface RecatState {
  txId: string;
  category: string;
  subcategory: string;
  saving: boolean;
}

export default function ReportsPage() {
  const router = useRouter();
  const [report, setReport]           = useState<ReportType>("category");
  const [year, setYear]               = useState(new Date().getFullYear());
  const [catPeriod, setCatPeriod]     = useState<CatPeriod>("last-month");
  const [catCustomStart, setCatCustomStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [catCustomEnd, setCatCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [catPriorData, setCatPriorData] = useState<SpendByCategory[]>([]);
  const [catAccountId, setCatAccountId] = useState<string>("");
  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [loading, setLoading]         = useState(false);
  const [catData, setCatData]         = useState<SpendByCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [yoyData, setYoyData]         = useState<{ month_num: number; month: string; current_year: number; prior_year: number; delta: number }[]>([]);
  const [yoyCategory, setYoyCategory] = useState<string>("");
  const [weekdayData, setWeekdayData] = useState<{ dow: number; day_name: string; transaction_count: number; total: number; avg_transaction: number; days_with_spend: number }[]>([]);
  const [budgetHistoryData, setBudgetHistoryData] = useState<{ month: string; category: string; budget_amount: number; actual_spend: number; pct_used: number }[]>([]);
  const [dailySpend, setDailySpend] = useState<{ date: string; total: number; count: number }[]>([]);
  const [calHover, setCalHover]     = useState<{ date: string; total: number; count: number } | null>(null);
  const [catTrend, setCatTrend]     = useState<{ month: string; total: number; count: number }[]>([]);
  const [cardData, setCardData]     = useState<SpendByCard[]>([]);
  const [merchantData, setMerchantData] = useState<{ merchant: string; category: string; subcategory: string | null; transaction_count: number; total_spend: number; avg_transaction: number; pct_of_total: number; last_seen: string | null }[]>([]);

  // Which category row is expanded
  const [drill, setDrill]     = useState<DrillState | null>(null);
  // Recategorize UI for a specific transaction
  const [recat, setRecat]     = useState<RecatState | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

  async function loadReport() {
    setLoading(true);
    setDrill(null);
    setCatPriorData([]);
    try {
      if (report === "category") {
        const { start, end } = getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
        const priorRange = getPriorPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
        const acctFilter = catAccountId || undefined;
        const [d, priorD] = await Promise.all([
          api.reports.spendingByCategory(start, end, acctFilter),
          priorRange ? api.reports.spendingByCategory(priorRange.start, priorRange.end, acctFilter) : Promise.resolve([]),
        ]);
        setCatData(d);
        setCatPriorData(priorD);
      } else if (report === "monthly") {
        const d = await api.reports.monthlySummary(year);
        setMonthlyData(d);
      } else if (report === "yoy") {
        const d = await api.reports.yoyComparison(yoyCategory || undefined);
        setYoyData(d);
      } else if (report === "card") {
        const { start, end } = getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
        const d = await api.reports.spendingByCard(start, end);
        setCardData(d);
      } else if (report === "merchants") {
        const { start, end } = getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
        const d = await api.reports.topMerchants(start, end, 25);
        setMerchantData(d);
      } else if (report === "weekday") {
        const d = await api.reports.spendingByWeekday(90);
        setWeekdayData(d);
      } else if (report === "budget-history") {
        const d = await api.reports.budgetHistory(6);
        setBudgetHistoryData(d);
      } else if (report === "calendar") {
        const d = await api.reports.dailySpend(year);
        setDailySpend(d);
      }
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport(); }, [report, year, yoyCategory, catPeriod, catCustomStart, catCustomEnd, catAccountId]);

  useEffect(() => {
    api.accounts.list().then((accts) => setAccounts(accts.filter((a) => a.is_active && !a.is_excluded))).catch(() => {});
  }, []);

  const drillKey = (category: string, subcategory: string | null) =>
    `${category}|${subcategory ?? ""}`;

  const handleRowClick = useCallback(async (row: SpendByCategory) => {
    const key = drillKey(row.category, row.subcategory);
    if (drill?.key === key) {
      setDrill(null);
      setRecat(null);
      return;
    }
    setDrill({ key, category: row.category, subcategory: row.subcategory, transactions: [], loading: true });
    setRecat(null);
    setCatTrend([]);
    const { start: drillStart, end: drillEnd } = getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
    try {
      const [resp, trend] = await Promise.all([
        api.transactions.list({
          start_date: drillStart,
          end_date:   drillEnd,
          category:   row.category,
          subcategory: row.subcategory ?? undefined,
          page_size:  200,
        }),
        row.subcategory ? Promise.resolve([]) : api.reports.categoryTrend(row.category, 13),
      ]);
      setDrill(prev => prev?.key === key
        ? { ...prev, transactions: resp.items, loading: false }
        : prev
      );
      setCatTrend(trend);
    } catch {
      toast.error("Failed to load transactions");
      setDrill(null);
    }
  }, [drill?.key, year, catPeriod, catCustomStart, catCustomEnd]);

  const startRecat = (tx: Transaction) => {
    setRecat({
      txId: tx.id,
      category: tx.category ?? "",
      subcategory: tx.subcategory ?? "",
      saving: false,
    });
  };

  const saveRecat = async () => {
    if (!recat || !drill) return;
    setRecat(r => r ? { ...r, saving: true } : r);
    try {
      await api.transactions.updateCategory(recat.txId, recat.category, recat.subcategory);
      // Refresh the drill transactions
      const { start: rStart, end: rEnd } = getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
      const resp = await api.transactions.list({
        start_date:  rStart,
        end_date:    rEnd,
        category:    drill.category,
        subcategory: drill.subcategory ?? undefined,
        page_size:   200,
      });
      setDrill(prev => prev ? { ...prev, transactions: resp.items } : prev);
      setRecat(null);
      toast.success("Transaction recategorized");
      // Also refresh the category totals
      const d = await api.reports.spendingByCategory(rStart, rEnd, catAccountId || undefined);
      setCatData(d);
    } catch {
      toast.error("Failed to recategorize transaction");
      setRecat(r => r ? { ...r, saving: false } : r);
    }
  };

  function downloadCSV() {
    let rows: string[][] = [];
    let filename = "";

    if (report === "category") {
      const { label: periodLabel } = getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd);
      filename = `hive-spending-by-category-${periodLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
      rows = [
        ["Category", "Subcategory", "Transactions", "Total Spent", "Avg Transaction"],
        ...catData.map((r) => [r.category, r.subcategory ?? "", String(r.transaction_count), String(r.total), String(r.avg_transaction)]),
      ];
    } else if (report === "monthly") {
      filename = `hive-monthly-summary-${year}.csv`;
      rows = [
        ["Month", "Income", "Expenses", "Net"],
        ...monthlyData.map((r) => [r.month, String(r.income), String(r.expenses), String(r.net)]),
      ];
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalSpend = catData.reduce((s, r) => s + r.total, 0);

  // Build prior period lookup: "category|subcategory" → total
  const priorLookup: Record<string, number> = {};
  for (const r of catPriorData) {
    const key = `${r.category}|${r.subcategory ?? ""}`;
    priorLookup[key] = (priorLookup[key] ?? 0) + r.total;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header row with PageHero + export */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow={report === "category" || report === "card"
              ? `Reports · ${getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd).label}`
              : `Reports · ${year}`
            }
            headline={
              report === "category"
                ? <><span className="text-[#38BDF8]">{catData.length}</span> categories</>
                : report === "card"
                ? <><span className="text-[#38BDF8]">{fmt(cardData.reduce((s,r)=>s+r.total_spend,0))}</span> across {cardData.length} cards</>
                : report === "monthly"
                ? (() => {
                    const totalInc = monthlyData.reduce((s, r) => s + r.income, 0);
                    const totalExp = monthlyData.reduce((s, r) => s + r.expenses, 0);
                    const rate = totalInc > 0 ? ((totalInc - totalExp) / totalInc * 100) : 0;
                    return <><span className={rate >= 0 ? "text-semantic-income" : "text-semantic-expense"}>{rate.toFixed(1)}%</span> avg saved</>;
                  })()
                : <><span className="text-semantic-expense">{fmt(dailySpend.reduce((s,d)=>s+d.total,0))}</span> spent</>
            }
            subtext="spending analysis & data export"
            glowColor="sky"
            statStrip={
              report === "category" && catData.length > 0 ? [
                { label: "Total Spend",   value: fmt(totalSpend),                                             color: "red"     },
                { label: "Categories",    value: String(catData.length),                                      color: "default" },
                { label: "Transactions",  value: String(catData.reduce((s, r) => s + r.transaction_count, 0)), color: "default" },
              ] : report === "card" && cardData.length > 0 ? [
                { label: "Total Spend",   value: fmt(cardData.reduce((s, r) => s + r.total_spend, 0)),        color: "red"     },
                { label: "Cards",         value: String(cardData.length),                                     color: "default" },
                { label: "Transactions",  value: String(cardData.reduce((s, r) => s + r.transaction_count, 0)), color: "default" },
              ] : report === "monthly" && monthlyData.length > 0 ? [
                { label: "Income",   value: fmt(monthlyData.reduce((s, r) => s + r.income, 0)),   color: "green" },
                { label: "Expenses", value: fmt(monthlyData.reduce((s, r) => s + r.expenses, 0)), color: "red"   },
                { label: "Months",   value: String(monthlyData.length),                            color: "default" },
              ] : report === "calendar" && dailySpend.length > 0 ? [
                { label: "Total Spent",  value: fmt(dailySpend.reduce((s,d)=>s+d.total,0)),   color: "red"     },
                { label: "Spending Days", value: String(dailySpend.length),                     color: "default" },
                { label: "Transactions", value: String(dailySpend.reduce((s,d)=>s+d.count,0)), color: "default" },
              ] : undefined
            }
          />
        </div>
        <button onClick={downloadCSV} className="hive-btn-secondary text-[13px] py-2 px-4 mt-1 shrink-0">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Controls */}
      <GlassCard className="p-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1">
          <p className="hive-label mb-2">Report Type</p>
          <FilterPills
            options={REPORT_OPTIONS}
            value={report}
            onChange={(v) => setReport(v as ReportType)}
          />
        </div>

        {/* Category/Card/Merchants tab: period picker */}
        {report === "category" || report === "card" || report === "merchants" ? (
          <div className="flex flex-col gap-1.5">
            <p className="hive-label">Period</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CAT_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setCatPeriod(opt.value); setDrill(null); }}
                  className={cn(
                    "px-2.5 py-[5px] rounded-[8px] text-[11px] font-medium border transition-colors",
                    catPeriod === opt.value
                      ? "bg-honey/10 border-honey/30 text-honey"
                      : "bg-white/[0.03] border-white/[0.07] text-ink-tertiary hover:text-ink-secondary hover:border-white/[0.14]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {catPeriod === "custom" && (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="date"
                  value={catCustomStart}
                  onChange={(e) => { setCatCustomStart(e.target.value); setDrill(null); }}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-[9px] px-2.5 py-[5px] text-[12px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
                />
                <span className="text-[11px] text-ink-ghost">–</span>
                <input
                  type="date"
                  value={catCustomEnd}
                  onChange={(e) => { setCatCustomEnd(e.target.value); setDrill(null); }}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-[9px] px-2.5 py-[5px] text-[12px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
                />
              </div>
            )}
            {catPeriod === "full-year" && (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="hive-select mt-1 text-[12px]"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {/* Account filter (only for category tab, not card tab which shows all accounts) */}
            {report === "category" && accounts.length > 1 && (
              <div className="mt-2">
                <p className="hive-label mb-1.5">Account</p>
                <select
                  value={catAccountId}
                  onChange={(e) => { setCatAccountId(e.target.value); setDrill(null); }}
                  className="hive-select text-[12px]"
                >
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.mask ? ` ••${a.mask}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="hive-label mb-2">Year</p>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="hive-select"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </GlassCard>

      {/* Report output */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</div>
        ) : report === "category" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-ink-primary">
                  Spending by Category — {getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd).label}
                </p>
                {catPriorData.length > 0 && (
                  <span className="text-[10px] text-ink-ghost bg-white/[0.04] px-1.5 py-0.5 rounded">
                    % vs prior period
                  </span>
                )}
                {catAccountId && (
                  <span className="text-[10px] text-honey bg-honey/[0.08] border border-honey/20 px-1.5 py-0.5 rounded">
                    {accounts.find((a) => a.id === catAccountId)?.name ?? "Filtered"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-tertiary">
                {catData.length} categories · {fmt(totalSpend)} total
              </p>
            </div>
            <div>
              {catData.map((row) => {
                const key       = drillKey(row.category, row.subcategory);
                const isOpen    = drill?.key === key;
                const pctOfTotal = totalSpend > 0 ? (row.total / totalSpend) * 100 : 0;
                const priorKey  = `${row.category}|${row.subcategory ?? ""}`;
                const priorTotal = priorLookup[priorKey];
                const delta     = priorTotal !== undefined ? row.total - priorTotal : null;
                const deltaPct  = priorTotal && priorTotal > 0 ? (delta! / priorTotal) * 100 : null;

                return (
                  <div key={key}>
                    {/* Category row — clickable */}
                    <button
                      onClick={() => handleRowClick(row)}
                      className={cn(
                        "w-full flex items-center gap-4 px-5 py-3 text-left transition-colors border-b border-white/[0.04]",
                        "hover:bg-white/[0.025]",
                        isOpen && "bg-white/[0.035]"
                      )}
                    >
                      {/* Expand chevron */}
                      <span className="text-ink-ghost shrink-0">
                        {isOpen
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />
                        }
                      </span>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-ink-primary">{row.category}</p>
                        {row.subcategory && <p className="text-[11px] text-ink-tertiary">{row.subcategory}</p>}
                      </div>

                      {/* Stats */}
                      <p className="text-[11px] text-ink-tertiary tabular-nums">{row.transaction_count} txns</p>
                      <p className="text-[11px] text-ink-tertiary tabular-nums">avg {fmt(row.avg_transaction)}</p>
                      {/* Prior period delta badge */}
                      {delta !== null && Math.abs(delta) >= 0.5 && (
                        <div className={cn(
                          "text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded shrink-0",
                          delta > 0
                            ? "text-semantic-expense bg-semantic-expense/10"
                            : "text-semantic-income bg-semantic-income/10"
                        )}>
                          {delta > 0 ? "+" : ""}{deltaPct !== null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(0)}%` : fmt(Math.abs(delta))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 w-32 justify-end">
                        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-400/60"
                            style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                          />
                        </div>
                        <p className="text-[14px] font-semibold font-mono text-ink-primary tabular-nums w-24 text-right shrink-0">
                          {fmt(row.total)}
                        </p>
                      </div>
                    </button>

                    {/* Drill-down panel */}
                    {isOpen && (
                      <div className="bg-black/[0.15] border-b border-white/[0.04]">
                        {drill?.loading ? (
                          <div className="flex items-center justify-center gap-2 py-8 text-ink-tertiary text-[12px]">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading transactions…</span>
                          </div>
                        ) : drill?.transactions.length === 0 ? (
                          <p className="py-6 text-center text-[12px] text-ink-tertiary">No transactions found.</p>
                        ) : (
                          <div>
                            {/* Category trend mini-chart */}
                            {catTrend.length > 1 && (
                              <div className="px-5 pt-3 pb-2 border-b border-white/[0.04]">
                                <p className="text-[10px] font-semibold text-ink-ghost uppercase tracking-wider mb-2">
                                  13-month trend · {drill?.category}
                                </p>
                                <div className="flex items-end gap-[3px] h-10">
                                  {catTrend.map((m) => {
                                    const maxT = Math.max(...catTrend.map(t => t.total), 1);
                                    const h = Math.round((m.total / maxT) * 100);
                                    const isCurrent = m.month === `${year}-${String(new Date().getMonth() + 1).padStart(2,"0")}`;
                                    return (
                                      <div
                                        key={m.month}
                                        className="flex-1 flex flex-col items-center gap-0.5"
                                        title={`${m.month}: ${fmt(m.total)}`}
                                      >
                                        <div
                                          className={cn("w-full rounded-sm transition-all", isCurrent ? "bg-sky-400/80" : "bg-sky-400/30")}
                                          style={{ height: `${Math.max(h, 2)}%` }}
                                        />
                                        <span className="text-[7px] text-ink-ghost/50 leading-none">{m.month.slice(5)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between px-5 py-2 border-b border-white/[0.04]">
                              <p className="text-[11px] text-ink-tertiary">
                                {drill?.transactions.length} transaction{drill?.transactions.length !== 1 ? "s" : ""}
                              </p>
                              <button
                                onClick={() => { setDrill(null); setRecat(null); setCatTrend([]); }}
                                className="text-ink-ghost hover:text-ink-tertiary transition-colors"
                                aria-label="Close"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            {drill?.transactions.map((tx) => {
                              const isRecatting = recat?.txId === tx.id;
                              return (
                                <div
                                  key={tx.id}
                                  className={cn(
                                    "px-5 py-2.5 border-b border-white/[0.03] last:border-0",
                                    isRecatting ? "bg-honey/[0.04]" : "hover:bg-white/[0.02]"
                                  )}
                                >
                                  {!isRecatting ? (
                                    <div className="flex items-center gap-3">
                                      <p className="text-[11px] text-ink-tertiary w-16 shrink-0 tabular-nums">{tx.date}</p>
                                      <p className="text-[12px] text-ink-primary flex-1 truncate">
                                        {tx.merchant || tx.raw_description}
                                      </p>
                                      <p className="text-[11px] text-ink-tertiary shrink-0">
                                        {tx.category}{tx.subcategory ? ` / ${tx.subcategory}` : ""}
                                      </p>
                                      <p className="text-[13px] font-mono font-medium text-ink-primary tabular-nums w-20 text-right shrink-0">
                                        {fmt(tx.amount)}
                                      </p>
                                      <button
                                        onClick={() => startRecat(tx)}
                                        className="text-[10px] text-ink-ghost hover:text-honey transition-colors shrink-0 px-1.5 py-0.5 rounded border border-white/[0.06] hover:border-honey/30"
                                      >
                                        Recategorize
                                      </button>
                                      <button
                                        onClick={() => router.push(`/transactions?open_tx=${tx.id}&search_all=true${tx.merchant ? `&search=${encodeURIComponent(tx.merchant)}` : ""}`)}
                                        className="flex items-center gap-0.5 text-[10px] text-ink-ghost hover:text-honey transition-colors shrink-0"
                                        title="View in transactions"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    /* Recategorize inline form */
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <p className="text-[11px] text-ink-tertiary w-16 shrink-0">{tx.date}</p>
                                        <p className="text-[12px] text-ink-primary flex-1 truncate">
                                          {tx.merchant || tx.raw_description}
                                        </p>
                                        <p className="text-[13px] font-mono font-medium text-ink-primary tabular-nums">
                                          {fmt(tx.amount)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 pl-[72px]">
                                        <select
                                          value={recat?.category ?? ""}
                                          onChange={(e) => setRecat(r => r ? { ...r, category: e.target.value, subcategory: "" } : r)}
                                          className="hive-select text-[11px] py-1 px-2 h-7"
                                        >
                                          <option value="">— category —</option>
                                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
              })}
            </div>
          </>
        ) : report === "monthly" ? (
          (() => {
            const totalIncome   = monthlyData.reduce((s, r) => s + r.income, 0);
            const totalExpenses = monthlyData.reduce((s, r) => s + r.expenses, 0);
            const totalNet      = totalIncome - totalExpenses;
            const avgSavingsRate = totalIncome > 0 ? (totalNet / totalIncome) * 100 : 0;
            const chartData = monthlyData.map((r) => ({
              month: r.month.slice(5), // "MM"
              income: r.income,
              expenses: r.expenses,
              savingsRate: r.income > 0 ? parseFloat(((r.net / r.income) * 100).toFixed(1)) : 0,
            }));
            return (
              <>
                {/* KPI strip */}
                <div className="grid grid-cols-4 gap-px border-b border-white/[0.04]">
                  {[
                    { label: "Total Income",   value: fmt(totalIncome),   color: "text-semantic-income"  },
                    { label: "Total Expenses",  value: fmt(totalExpenses), color: "text-semantic-expense" },
                    { label: "Net Saved",       value: `${totalNet >= 0 ? "+" : ""}${fmt(totalNet)}`, color: totalNet >= 0 ? "text-semantic-income" : "text-semantic-expense" },
                    { label: "Avg Savings Rate", value: `${avgSavingsRate.toFixed(1)}%`, color: avgSavingsRate >= 0 ? "text-semantic-income" : "text-semantic-expense" },
                  ].map((k) => (
                    <div key={k.label} className="px-5 py-4 border-r border-white/[0.04] last:border-r-0">
                      <p className="hive-label mb-1">{k.label}</p>
                      <p className={cn("text-[18px] font-bold font-mono tabular-nums tracking-tight", k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <div className="px-5 pt-5 pb-2">
                    <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-3">Income vs Expenses — {year}</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={chartData} barCategoryGap="30%" margin={{ top: 8, right: 48, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="dollars"
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                        />
                        <YAxis
                          yAxisId="pct"
                          orientation="right"
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          domain={[-20, 60]}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(15,15,20,0.95)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.85)",
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === "savingsRate") return [`${value}%`, "Savings rate"];
                            if (name === "income") return [fmt(value), "Income"];
                            if (name === "expenses") return [fmt(value), "Expenses"];
                            return [value, name];
                          }}
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        />
                        <Legend
                          formatter={(v) =>
                            v === "income" ? "Income" : v === "expenses" ? "Expenses" : "Savings rate"
                          }
                          wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
                        />
                        <Bar yAxisId="dollars" dataKey="income"   fill="rgba(52,211,153,0.55)"  radius={[3,3,0,0]} cursor="pointer" onClick={(d: { month: string }) => router.push(`/transactions?month=${year}-${d.month}&include_excluded=true`)} />
                        <Bar yAxisId="dollars" dataKey="expenses" fill="rgba(251,113,133,0.45)" radius={[3,3,0,0]} cursor="pointer" onClick={(d: { month: string }) => router.push(`/transactions?month=${year}-${d.month}`)} />
                        <Line
                          yAxisId="pct"
                          type="monotone"
                          dataKey="savingsRate"
                          stroke="rgba(250,189,0,0.85)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "rgba(250,189,0,0.85)", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Table */}
                <div className="border-t border-white/[0.04]">
                  <div className="grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-0 px-5 py-2 border-b border-white/[0.04]">
                    {["Month", "Income", "Expenses", "Net", "Save %"].map((h) => (
                      <p key={h} className="text-[10px] font-semibold text-ink-ghost uppercase tracking-wider text-right first:text-left">
                        {h}
                      </p>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {monthlyData.map((row) => {
                      const savePct = row.income > 0 ? (row.net / row.income) * 100 : 0;
                      return (
                        <div
                          key={row.month}
                          className="grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-0 px-5 py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => router.push(`/transactions?month=${row.month}`)}
                        >
                          <p className="text-[12px] font-mono text-ink-secondary">{row.month}</p>
                          <p className="text-[12px] font-mono text-semantic-income text-right">{fmt(row.income)}</p>
                          <p className="text-[12px] font-mono text-semantic-expense text-right">{fmt(row.expenses)}</p>
                          <p className={cn("text-[12px] font-mono font-semibold text-right", row.net >= 0 ? "text-semantic-income" : "text-semantic-expense")}>
                            {row.net >= 0 ? "+" : ""}{fmt(row.net)}
                          </p>
                          <p className={cn("text-[12px] font-mono text-right", savePct >= 20 ? "text-semantic-income" : savePct >= 0 ? "text-honey" : "text-semantic-expense")}>
                            {row.income > 0 ? `${savePct.toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()
        ) : report === "yoy" ? (
          <>
            {/* YoY header + category filter */}
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-4 flex-wrap">
              <p className="text-[13px] font-medium text-ink-primary flex-1">
                Year-over-Year — {new Date().getFullYear() - 1} vs {new Date().getFullYear()}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-ink-tertiary">Filter category</label>
                <select
                  value={yoyCategory}
                  onChange={(e) => setYoyCategory(e.target.value)}
                  className="hive-select text-[12px] py-1 px-2 h-7"
                >
                  <option value="">All categories</option>
                  {CATEGORIES.filter(c => c !== "Transfers" && c !== "Uncategorized").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {yoyCategory && (
                  <button
                    onClick={() => setYoyCategory("")}
                    className="text-ink-ghost hover:text-ink-tertiary"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Bar chart */}
            {yoyData.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-ink-tertiary">No data for this period.</p>
            ) : (
              <div className="p-5 space-y-6">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={yoyData} barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,15,20,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.85)",
                      }}
                      formatter={(value: number, name: string) => [
                        fmt(value),
                        name === "prior_year" ? String(new Date().getFullYear() - 1) : String(new Date().getFullYear()),
                      ]}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "prior_year"
                          ? String(new Date().getFullYear() - 1)
                          : String(new Date().getFullYear())
                      }
                      wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
                    />
                    <Bar dataKey="prior_year" fill="rgba(148,163,184,0.35)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="current_year" fill="rgba(56,189,248,0.7)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Month-by-month delta table */}
                <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                  <div className="grid grid-cols-5 gap-0 px-4 py-2 bg-white/[0.025] border-b border-white/[0.04]">
                    {["Month", String(new Date().getFullYear() - 1), String(new Date().getFullYear()), "Change ($)", "Change (%)"].map(h => (
                      <p key={h} className="text-[10px] text-ink-tertiary/60 font-medium uppercase tracking-wide text-right first:text-left">{h}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {yoyData.map((row) => {
                      const pct = row.prior_year > 0 ? ((row.delta / row.prior_year) * 100) : null;
                      const up = row.delta > 0;
                      const flat = Math.abs(row.delta) < 1;
                      return (
                        <div key={row.month_num} className="grid grid-cols-5 gap-0 px-4 py-2 hover:bg-white/[0.02] transition-colors">
                          <p className="text-[12px] text-ink-primary">{row.month}</p>
                          <p className="text-[12px] font-mono text-ink-secondary text-right tabular-nums">{fmt(row.prior_year)}</p>
                          <p className="text-[12px] font-mono text-ink-secondary text-right tabular-nums">{fmt(row.current_year)}</p>
                          <p className={cn(
                            "text-[12px] font-mono text-right tabular-nums flex items-center justify-end gap-1",
                            flat ? "text-ink-tertiary" : up ? "text-semantic-expense" : "text-semantic-income"
                          )}>
                            {flat ? <Minus size={10} /> : up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {up ? "+" : ""}{fmt(row.delta)}
                          </p>
                          <p className={cn(
                            "text-[12px] font-mono text-right tabular-nums",
                            flat || pct === null ? "text-ink-tertiary" : up ? "text-semantic-expense" : "text-semantic-income"
                          )}>
                            {pct !== null ? `${up ? "+" : ""}${pct.toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : report === "weekday" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04]">
              <p className="text-[13px] font-medium text-ink-primary">Spending by Day of Week — last 90 days</p>
            </div>
            {weekdayData.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-ink-tertiary">No data for this period.</p>
            ) : (
              <div className="p-5">
                {/* Bar chart */}
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weekdayData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="day_name"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,15,20,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.85)",
                      }}
                      formatter={(value: number, name: string) => [
                        fmt(value),
                        name === "total" ? "Total spent" : "Avg per txn",
                      ]}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                      {weekdayData.map((d) => (
                        <Cell
                          key={d.dow}
                          fill={d.dow === 0 || d.dow === 6
                            ? "rgba(201,146,14,0.6)"
                            : "rgba(56,189,248,0.6)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Per-day table */}
                <div className="mt-6 border border-white/[0.06] rounded-lg overflow-hidden">
                  <div className="grid grid-cols-5 gap-0 px-4 py-2 bg-white/[0.025] border-b border-white/[0.04]">
                    {["Day", "Total Spend", "Transactions", "Avg / txn", "Days w/ Spend"].map(h => (
                      <p key={h} className="text-[10px] text-ink-tertiary/60 font-medium uppercase tracking-wide text-right first:text-left">{h}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {weekdayData.map((row) => {
                      const isWeekend = row.dow === 0 || row.dow === 6;
                      return (
                        <div key={row.dow} className={cn("grid grid-cols-5 gap-0 px-4 py-2.5 hover:bg-white/[0.02] transition-colors", isWeekend && "bg-white/[0.01]")}>
                          <p className={cn("text-[12px] font-medium", isWeekend ? "text-honey" : "text-ink-primary")}>{row.day_name}</p>
                          <p className="text-[12px] font-mono text-ink-secondary text-right tabular-nums">{fmt(row.total)}</p>
                          <p className="text-[12px] font-mono text-ink-tertiary text-right tabular-nums">{row.transaction_count}</p>
                          <p className="text-[12px] font-mono text-ink-tertiary text-right tabular-nums">{fmt(row.avg_transaction)}</p>
                          <p className="text-[12px] font-mono text-ink-tertiary text-right tabular-nums">{row.days_with_spend}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[10px] text-ink-ghost mt-3">Weekend days highlighted. Data from last 90 days.</p>
              </div>
            )}
          </>
        ) : report === "budget-history" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04]">
              <p className="text-[13px] font-medium text-ink-primary">Budget History — last 6 months</p>
            </div>
            {budgetHistoryData.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-ink-tertiary">No budget history found. Set budgets to track history.</p>
            ) : (() => {
              // Pivot: get unique months and categories
              const months = [...new Set(budgetHistoryData.map(r => r.month))].sort();
              const categories = [...new Set(budgetHistoryData.map(r => r.category))].sort();

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="px-5 py-3 text-[10px] font-medium text-ink-tertiary/60 uppercase tracking-wide sticky left-0 bg-[rgba(10,11,16,0.9)]">Category</th>
                        {months.map(m => (
                          <th key={m} className="px-4 py-3 text-[10px] font-medium text-ink-tertiary/60 uppercase tracking-wide text-center min-w-[100px]">{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {categories.map(cat => (
                        <tr key={cat} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 text-[12px] text-ink-primary font-medium sticky left-0 bg-[rgba(10,11,16,0.9)]">{cat}</td>
                          {months.map(m => {
                            const row = budgetHistoryData.find(r => r.month === m && r.category === cat);
                            if (!row) return <td key={m} className="px-4 py-3 text-center text-ink-ghost text-[11px]">—</td>;
                            const over = row.actual_spend > row.budget_amount;
                            return (
                              <td key={m} className="px-4 py-3 text-center cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={() => router.push(`/transactions?month=${m}&category=${encodeURIComponent(cat)}`)}>
                                <div className={cn("text-[12px] font-mono font-semibold tabular-nums", over ? "text-semantic-expense" : "text-semantic-income")}>
                                  {fmt(row.actual_spend)}
                                </div>
                                <div className="text-[10px] text-ink-ghost">{row.pct_used.toFixed(0)}% of {fmt(row.budget_amount)}</div>
                                <div className="h-1 mt-1 bg-white/[0.04] rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", over ? "bg-semantic-expense/60" : "bg-semantic-income/50")}
                                    style={{ width: `${Math.min(row.pct_used, 100)}%` }}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        ) : report === "calendar" ? (
          (() => {
            // Build a day-keyed lookup
            const byDate: Record<string, { total: number; count: number }> = {};
            let maxDay = 0;
            for (const d of dailySpend) {
              byDate[d.date] = { total: d.total, count: d.count };
              if (d.total > maxDay) maxDay = d.total;
            }

            // Generate all 53 weeks × 7 days for the year
            const jan1 = new Date(year, 0, 1);
            const startDay = new Date(jan1);
            startDay.setDate(1 - jan1.getDay()); // rewind to Sunday

            const weeks: { date: string; inYear: boolean }[][] = [];
            const cur = new Date(startDay);
            while (cur.getFullYear() <= year) {
              const week: { date: string; inYear: boolean }[] = [];
              for (let d = 0; d < 7; d++) {
                const iso = cur.toISOString().slice(0, 10);
                week.push({ date: iso, inYear: cur.getFullYear() === year });
                cur.setDate(cur.getDate() + 1);
              }
              weeks.push(week);
              if (cur.getFullYear() > year && cur.getMonth() > 0) break;
            }

            const totalSpent = dailySpend.reduce((s, d) => s + d.total, 0);
            const activeDays = dailySpend.length;
            const avgDay    = activeDays > 0 ? totalSpent / activeDays : 0;
            const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const DAYS = ["S","M","T","W","T","F","S"];

            // Color cell based on spend intensity
            function cellColor(total: number): string {
              if (total === 0) return "rgba(255,255,255,0.04)";
              const pct = maxDay > 0 ? total / maxDay : 0;
              if (pct < 0.15) return "rgba(251,113,133,0.20)";
              if (pct < 0.35) return "rgba(251,113,133,0.40)";
              if (pct < 0.60) return "rgba(251,113,133,0.60)";
              if (pct < 0.80) return "rgba(251,113,133,0.80)";
              return "rgba(251,113,133,1.00)";
            }

            return (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-3 gap-px border-b border-white/[0.04]">
                  {[
                    { label: "Total Spend",  value: fmt(totalSpent),               color: "text-semantic-expense" },
                    { label: "Spending Days", value: String(activeDays),            color: "text-ink-primary"      },
                    { label: "Avg Active Day", value: fmt(avgDay),                  color: "text-honey"            },
                  ].map((k) => (
                    <div key={k.label} className="px-5 py-4 border-r border-white/[0.04] last:border-r-0">
                      <p className="hive-label mb-1">{k.label}</p>
                      <p className={cn("text-[18px] font-bold font-mono tabular-nums", k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="p-5 overflow-x-auto">
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-4">
                    Daily Spend — {year}
                  </p>

                  {/* Month labels */}
                  <div className="flex items-end gap-0 mb-1 ml-6">
                    {weeks.map((week, wi) => {
                      const firstInYear = week.find(d => d.inYear);
                      if (!firstInYear) return <div key={wi} className="w-[11px] mr-[1px]" />;
                      const d = new Date(firstInYear.date + "T12:00:00");
                      if (d.getDate() <= 7) {
                        return (
                          <div key={wi} className="w-[11px] mr-[1px] text-[8px] text-ink-ghost/60 text-center">
                            {MONTHS[d.getMonth()]}
                          </div>
                        );
                      }
                      return <div key={wi} className="w-[11px] mr-[1px]" />;
                    })}
                  </div>

                  <div className="flex gap-0">
                    {/* Day of week labels */}
                    <div className="flex flex-col gap-[1px] mr-1">
                      {DAYS.map((d, i) => (
                        <div key={i} className="h-[11px] w-4 text-[8px] text-ink-ghost/50 flex items-center justify-end pr-0.5">
                          {i % 2 === 1 ? d : ""}
                        </div>
                      ))}
                    </div>

                    {/* Weeks */}
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[1px] mr-[1px]">
                        {week.map((cell, di) => {
                          const info = byDate[cell.date];
                          const total = info?.total ?? 0;
                          return (
                            <div
                              key={di}
                              className={cn(
                                "w-[11px] h-[11px] rounded-[2px] transition-opacity hover:opacity-80",
                                cell.inYear && total > 0 ? "cursor-pointer" : "cursor-default"
                              )}
                              style={{
                                background: cell.inYear ? cellColor(total) : "transparent",
                                opacity: cell.inYear ? 1 : 0,
                              }}
                              onMouseEnter={() => cell.inYear && info ? setCalHover({ date: cell.date, ...info }) : setCalHover(null)}
                              onMouseLeave={() => setCalHover(null)}
                              onClick={() => {
                                if (cell.inYear && total > 0) {
                                  router.push(`/transactions?start_date=${cell.date}&end_date=${cell.date}`);
                                }
                              }}
                              title={cell.inYear && total > 0
                                ? `${cell.date}: ${fmt(total)} — click to view transactions`
                                : cell.inYear ? `${cell.date}: no spend` : ""}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Hover tooltip */}
                  {calHover ? (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-secondary">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cellColor(calHover.total) }} />
                      <span className="font-mono text-ink-primary">{calHover.date}</span>
                      <span>·</span>
                      <span className="font-semibold text-semantic-expense">{fmt(calHover.total)}</span>
                      <span className="text-ink-ghost">({calHover.count} txn{calHover.count !== 1 ? "s" : ""})</span>
                    </div>
                  ) : (
                    <div className="mt-3 h-5 flex items-center gap-3">
                      <span className="text-[10px] text-ink-ghost">Less</span>
                      {[0, 0.15, 0.35, 0.60, 0.80, 1.0].map((pct, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: cellColor(pct * maxDay) }} />
                      ))}
                      <span className="text-[10px] text-ink-ghost">More</span>
                    </div>
                  )}
                </div>
              </>
            );
          })()
        ) : report === "card" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-primary">
                Spending by Card — {getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd).label}
              </p>
              <p className="text-[11px] text-ink-tertiary">
                {cardData.length} account{cardData.length !== 1 ? "s" : ""}
                {cardData.length > 0 ? ` · ${fmt(cardData.reduce((s, r) => s + r.total_spend, 0))} total` : ""}
              </p>
            </div>
            {cardData.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-ink-tertiary">No spending data for this period.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {(() => {
                  const grandTotal = cardData.reduce((s, r) => s + r.total_spend, 0);
                  return cardData.map((card) => {
                    const pct = grandTotal > 0 ? (card.total_spend / grandTotal) * 100 : 0;
                    return (
                      <div key={card.account_id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => router.push(`/transactions?account_id=${card.account_id}&search_all=true`)}>
                        <div className="flex items-start gap-4">
                          {/* Account info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[13px] font-semibold text-ink-primary truncate">{card.account_name}</p>
                              {card.card_slug && (
                                <span className="text-[10px] font-medium text-ink-ghost bg-white/[0.04] border border-white/[0.07] px-1.5 py-0.5 rounded shrink-0">
                                  {card.card_slug}
                                </span>
                              )}
                              <span className="text-[10px] text-ink-ghost shrink-0">
                                {card.transaction_count} txn{card.transaction_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                              <div
                                className="h-full rounded-full bg-sky-400/60 transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            {/* Top categories */}
                            {card.top_categories.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {card.top_categories.map((c) => (
                                  <span key={c.category} className="text-[10px] text-ink-ghost bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                                    {c.category} · {fmt(c.total)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Amount + % */}
                          <div className="text-right shrink-0">
                            <p className="text-[16px] font-bold font-mono tabular-nums text-ink-primary">{fmt(card.total_spend)}</p>
                            <p className="text-[11px] text-ink-tertiary">{pct.toFixed(1)}% of total</p>
                            <p className="text-[10px] text-ink-ghost">avg {fmt(card.avg_transaction)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </>
        ) : report === "merchants" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-primary">
                Top Merchants — {getPeriodDates(catPeriod, year, catCustomStart, catCustomEnd).label}
              </p>
              <p className="text-[11px] text-ink-tertiary">
                {merchantData.length} merchants
                {merchantData.length > 0 ? ` · ${fmt(merchantData.reduce((s, r) => s + r.total_spend, 0))} total` : ""}
              </p>
            </div>
            {merchantData.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-ink-tertiary">No spending data for this period.</p>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {merchantData.map((m, i) => {
                  const barW = merchantData[0].total_spend > 0 ? (m.total_spend / merchantData[0].total_spend) * 100 : 0;
                  return (
                    <button
                      key={m.merchant}
                      className="w-full text-left px-5 py-3.5 hover:bg-white/[0.025] transition-colors"
                      onClick={() => router.push(`/transactions?search=${encodeURIComponent(m.merchant)}`)}
                    >
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[11px] font-mono text-ink-ghost w-5 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-ink-primary truncate">{m.merchant}</p>
                          <p className="text-[11px] text-ink-ghost">
                            {m.category}{m.subcategory ? ` · ${m.subcategory}` : ""}
                            {" · "}{m.transaction_count} txn{m.transaction_count !== 1 ? "s" : ""}
                            {" · "}avg {fmt(m.avg_transaction)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[15px] font-bold font-mono tabular-nums text-ink-primary">{fmt(m.total_spend)}</p>
                          <p className="text-[11px] text-ink-tertiary">{m.pct_of_total.toFixed(1)}% of total</p>
                        </div>
                      </div>
                      {/* Relative bar */}
                      <div className="ml-8 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-honey/50 transition-all duration-500"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </GlassCard>
    </div>
  );
}
