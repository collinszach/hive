"use client";

import { useEffect, useState } from "react";
import { api, SpendByCategory } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { FilterPills } from "@/components/FilterPills";
import { PageHero } from "@/components/PageHero";

type ReportType = "category" | "monthly" | "tax";

interface MonthlyRow {
  month: string;
  expenses: number;
  income: number;
  net: number;
  expense_count: number;
}

interface TaxRow {
  date: string;
  amount: number;
  merchant: string;
  category: string;
  subcategory: string | null;
}

const REPORT_OPTIONS = [
  { label: "By Category", value: "category" },
  { label: "Monthly",     value: "monthly"  },
  { label: "Tax Export",  value: "tax"      },
];

export default function ReportsPage() {
  const [report, setReport]           = useState<ReportType>("category");
  const [year, setYear]               = useState(new Date().getFullYear());
  const [loading, setLoading]         = useState(false);
  const [catData, setCatData]         = useState<SpendByCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [taxData, setTaxData]         = useState<TaxRow[]>([]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

  async function loadReport() {
    setLoading(true);
    try {
      if (report === "category") {
        const d = await api.reports.spendingByCategory(
          `${year}-01-01`,
          `${year}-12-31`
        );
        setCatData(d);
      } else if (report === "monthly") {
        const d = await api.reports.monthlySummary(year);
        setMonthlyData(d);
      } else {
        const d = await api.reports.taxExport(year);
        setTaxData(d);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport(); }, [report, year]);

  function downloadCSV() {
    let rows: string[][] = [];
    let filename = "";

    if (report === "category") {
      filename = `hive-spending-by-category-${year}.csv`;
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
    } else {
      filename = `hive-tax-export-${year}.csv`;
      rows = [
        ["Date", "Amount", "Merchant", "Category", "Subcategory"],
        ...taxData.map((r) => [r.date, String(r.amount), r.merchant, r.category, r.subcategory ?? ""]),
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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header row with PageHero + export */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow={`Reports · ${year}`}
            headline={
              report === "category"
                ? <><span className="text-[#38BDF8]">{catData.length}</span> categories</>
                : report === "monthly"
                ? <><span className="text-semantic-income">{monthlyData.length}</span> months</>
                : <><span className="text-honey">{taxData.length}</span> transactions</>
            }
            subtext="spending analysis & data export"
            glowColor="sky"
            statStrip={report === "category" && catData.length > 0 ? [
              { label: "Total Spend", value: fmt(catData.reduce((s, r) => s + r.total, 0)), color: "red" },
              { label: "Categories", value: String(catData.length), color: "default" },
              { label: "Transactions", value: String(catData.reduce((s, r) => s + r.transaction_count, 0)), color: "default" },
            ] : undefined}
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
      </GlassCard>

      {/* Report output */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</div>
        ) : report === "category" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-primary">Spending by Category — {year}</p>
              <p className="text-[11px] text-ink-tertiary">
                {catData.length} categories · {fmt(catData.reduce((s, r) => s + r.total, 0))} total
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {catData.map((row) => (
                <div key={`${row.category}-${row.subcategory}`}
                     className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink-primary">{row.category}</p>
                    {row.subcategory && <p className="text-[11px] text-ink-tertiary">{row.subcategory}</p>}
                  </div>
                  <p className="text-[11px] text-ink-tertiary">{row.transaction_count} txns</p>
                  <p className="text-[11px] text-ink-tertiary">avg {fmt(row.avg_transaction)}</p>
                  <p className="text-[14px] font-semibold font-mono text-ink-primary tabular-nums w-24 text-right">{fmt(row.total)}</p>
                </div>
              ))}
            </div>
          </>
        ) : report === "monthly" ? (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04]">
              <p className="text-[13px] font-medium text-ink-primary">Monthly Summary — {year}</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {monthlyData.map((row) => (
                <div key={row.month}
                     className="flex items-center gap-6 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <p className="text-[13px] text-ink-primary w-16">{row.month}</p>
                  <div className="flex-1 grid grid-cols-3 gap-4 text-right">
                    <div>
                      <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Income</p>
                      <p className="text-[13px] font-mono text-semantic-income">{fmt(row.income)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Expenses</p>
                      <p className="text-[13px] font-mono text-semantic-expense">{fmt(row.expenses)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-tertiary/60 mb-0.5">Net</p>
                      <p className={cn("text-[13px] font-mono font-semibold", row.net >= 0 ? "text-semantic-income" : "text-semantic-expense")}>
                        {row.net >= 0 ? "+" : ""}{fmt(row.net)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-primary">Tax Export — {year}</p>
              <p className="text-[11px] text-ink-tertiary">{taxData.length} transactions</p>
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
              {taxData.map((row, i) => (
                <div key={i}
                     className="flex items-center gap-4 px-5 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <p className="text-[11px] text-ink-tertiary w-20 shrink-0">{row.date}</p>
                  <p className="text-[12px] text-ink-primary flex-1 truncate">{row.merchant}</p>
                  <p className="text-[11px] text-ink-tertiary">
                    {row.category}{row.subcategory ? ` / ${row.subcategory}` : ""}
                  </p>
                  <p className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums">{fmt(row.amount)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
