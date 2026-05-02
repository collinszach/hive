"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ExternalLink } from "lucide-react";
import { cn, fmt } from "@/lib/utils";
import { LedgerEntry } from "@/lib/api";
import { POINT_VALUES_CPP } from "@/lib/pointsConstants";

const CARD_LABELS: Record<string, string> = {
  amex_gold:       "Amex Gold",
  chase_sapphire:  "Chase Sapphire",
  chase_southwest: "Chase Southwest",
  bilt_blue:       "Bilt Blue",
  venture_x:       "Venture X",
};

interface EarnActivityProps {
  ledger: LedgerEntry[];
  loading: boolean;
  error: boolean;
  filterPrograms?: string[];
  onFilterProgramsChange?: (programs: string[]) => void;
}

export function EarnActivity({ ledger, loading, error, filterPrograms: externalFilterPrograms, onFilterProgramsChange }: EarnActivityProps) {
  const router = useRouter();
  const [search, setSearch]                         = useState("");
  const [internalFilterPrograms, setInternalFilter] = useState<string[]>([]);
  const [filterCards, setFilterCards]               = useState<string[]>([]);

  const filterPrograms   = externalFilterPrograms ?? internalFilterPrograms;
  const setFilterPrograms = onFilterProgramsChange ?? setInternalFilter;

  const allPrograms = useMemo(() => [...new Set(ledger.map((e) => e.program))].sort(), [ledger]);
  const allCards    = useMemo(() => [...new Set(ledger.map((e) => e.card_slug))].sort(), [ledger]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ledger.filter((e) => {
      if (q && !(e.merchant ?? "").toLowerCase().includes(q)) return false;
      if (filterPrograms.length && !filterPrograms.includes(e.program)) return false;
      if (filterCards.length && !filterCards.includes(e.card_slug)) return false;
      return true;
    });
  }, [ledger, search, filterPrograms, filterCards]);

  function toggleProgram(prog: string) {
    setFilterPrograms(
      filterPrograms.includes(prog) ? filterPrograms.filter((x) => x !== prog) : [...filterPrograms, prog]
    );
  }

  function toggleCard(slug: string) {
    setFilterCards((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]
    );
  }

  function clearFilters() {
    setSearch("");
    setFilterPrograms([]);
    setFilterCards([]);
  }

  const hasFilters = search || filterPrograms.length || filterCards.length;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink-primary">
          Earn Activity
          {!loading && (
            <span className="ml-2 text-[12px] font-normal text-ink-tertiary">
              {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[12px] text-ink-tertiary hover:text-ink-secondary flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant…"
          className="w-full pl-8 pr-3 py-2 text-[13px] bg-white/[0.04] border border-white/[0.07] rounded-lg text-ink-primary placeholder:text-ink-tertiary/40 focus:outline-none focus:border-honey/30 transition-colors"
        />
      </div>

      {/* Filter pills */}
      {(allPrograms.length > 1 || allCards.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {allPrograms.map((prog) => (
            <button
              key={prog}
              type="button"
              onClick={() => toggleProgram(prog)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150",
                filterPrograms.includes(prog)
                  ? "bg-honey/15 border-honey/30 text-honey"
                  : "border-white/[0.08] text-ink-tertiary hover:text-ink-secondary"
              )}
            >
              {prog}
            </button>
          ))}
          <div className="w-px bg-white/[0.06] self-stretch" />
          {allCards.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleCard(slug)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150",
                filterCards.includes(slug)
                  ? "bg-white/[0.08] border-white/[0.15] text-ink-primary"
                  : "border-white/[0.08] text-ink-tertiary hover:text-ink-secondary"
              )}
            >
              {CARD_LABELS[slug] ?? slug}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="hive-card p-6 text-center text-[13px] text-ink-tertiary border-dashed">
          Failed to load earn activity.
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="hive-card p-10 text-center border-dashed">
          <p className="text-[14px] text-ink-secondary mb-1">No transactions found</p>
          <p className="text-[12px] text-ink-tertiary">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="hive-card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Date", "Merchant", "Category", "Card", "Rate", "Points", "Est. Value", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] text-ink-tertiary font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const cpp = POINT_VALUES_CPP[entry.program] ?? 1.0;
                const estValue = (entry.points_earned * cpp) / 100;
                return (
                  <tr
                    key={entry.transaction_id}
                    className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.04] transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/transactions?open_tx=${entry.transaction_id}&search_all=true${entry.merchant ? `&search=${encodeURIComponent(entry.merchant)}` : ""}`
                      )
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-ink-tertiary whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="px-4 py-2.5 text-ink-primary max-w-[160px] truncate">
                      {entry.merchant ?? <span className="text-ink-tertiary/50">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-tertiary">
                      {[entry.category, entry.subcategory].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-tertiary">
                      {CARD_LABELS[entry.card_slug] ?? entry.card_slug}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-secondary tabular-nums">
                      {entry.earn_rate}x
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-secondary tabular-nums">
                      {Math.round(entry.points_earned).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-semantic-income tabular-nums">
                      ~{fmt(estValue)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-ghost hover:text-honey transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
