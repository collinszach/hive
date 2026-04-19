"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  Star,
  Zap,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { api, Transaction } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Open the palette from anywhere ────────────────────────────
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("hive:cmd-k"));
}

// ── Quick nav links shown when the query is empty ─────────────
const QUICK_NAV = [
  { label: "Dashboard",    href: "/",             icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: Receipt          },
  { label: "Cash Flow",    href: "/cash-flow",    icon: ArrowLeftRight   },
  { label: "Points",       href: "/points",       icon: Star             },
  { label: "Optimizer",    href: "/optimize",     icon: Zap              },
  { label: "AI Chat",      href: "/chat",         icon: MessageSquare    },
] as const;

// ── Helpers ───────────────────────────────────────────────────
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Category badge ────────────────────────────────────────────
function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/[0.05] text-[#6B6560] border border-white/[0.06] whitespace-nowrap">
      {category}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Transaction[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef   = useRef<HTMLInputElement>(null);
  const debounceId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef    = useRef<HTMLDivElement>(null);

  // Total navigable items: quick nav (when empty) OR transaction results
  const isQuickNav   = query.trim().length === 0;
  const totalItems   = isQuickNav ? QUICK_NAV.length : results.length;

  // ── Open / close ───────────────────────────────────────────
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
    setSelected(0);
    // Focus input after paint
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  // ── Global keyboard shortcut + custom event ────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        closePalette();
      }
    }
    function onCustomEvent() {
      if (!open) openPalette();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("hive:cmd-k", onCustomEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hive:cmd-k", onCustomEvent);
    };
  }, [open, openPalette, closePalette]);

  // ── Arrow key + Enter navigation ──────────────────────────
  useEffect(() => {
    if (!open) return;
    function onKeyNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(selected);
      }
    }
    window.addEventListener("keydown", onKeyNav);
    return () => window.removeEventListener("keydown", onKeyNav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, totalItems, isQuickNav, results]);

  // ── Scroll selected item into view ────────────────────────
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>("[data-selected='true']");
    item?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // ── Debounced search ──────────────────────────────────────
  useEffect(() => {
    if (debounceId.current) clearTimeout(debounceId.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceId.current = setTimeout(async () => {
      try {
        const res = await api.transactions.list({ search: trimmed, page_size: 8 });
        setResults(res.items);
        setSelected(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceId.current) clearTimeout(debounceId.current);
    };
  }, [query]);

  // ── Navigation handler ─────────────────────────────────────
  function handleSelect(index: number) {
    if (isQuickNav) {
      const nav = QUICK_NAV[index];
      if (nav) {
        router.push(nav.href);
        closePalette();
      }
    } else {
      const txn = results[index];
      if (txn) {
        const merchant = txn.merchant ?? txn.raw_description;
        router.push(`/transactions?search=${encodeURIComponent(merchant)}`);
        closePalette();
      }
    }
  }

  if (!open) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]"
        onClick={closePalette}
        aria-hidden="true"
      />

      {/* ── Modal ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101] px-4"
      >
        <div className="rounded-2xl bg-[#0F0F14] border border-white/[0.08] shadow-2xl overflow-hidden animate-fade-in">

          {/* ── Search input row ── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
            <Search
              className="w-[15px] h-[15px] shrink-0 text-[#4A4640]"
              strokeWidth={2}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              placeholder="Search transactions or navigate…"
              className="flex-1 bg-transparent text-[15px] text-ink-primary placeholder-[#4B5063]/70 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {/* ESC hint */}
            <kbd className="hidden sm:inline-flex text-[10px] text-[#3A3630] bg-white/[0.04] border border-white/[0.07] rounded px-1.5 py-0.5 leading-tight shrink-0">
              ESC
            </kbd>
          </div>

          {/* ── Results area ── */}
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight: 300 }}
          >
            {/* Quick nav */}
            {isQuickNav && (
              <div className="py-1">
                <p className="px-5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                  Navigate
                </p>
                {QUICK_NAV.map((nav, i) => {
                  const Icon = nav.icon;
                  const isSelected = selected === i;
                  return (
                    <button
                      key={nav.href}
                      data-selected={isSelected}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100",
                        isSelected
                          ? "bg-[rgba(245,185,66,0.07)]"
                          : "hover:bg-white/[0.03]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center w-7 h-7 rounded-[8px] shrink-0 transition-colors duration-100",
                          isSelected
                            ? "bg-[rgba(245,185,66,0.14)] text-[#F5B942]"
                            : "bg-white/[0.04] text-[#4A4640]"
                        )}
                      >
                        <Icon className="w-[14px] h-[14px]" strokeWidth={1.8} />
                      </span>
                      <span
                        className={cn(
                          "text-[13px] font-medium transition-colors duration-100",
                          isSelected ? "text-[#F5B942]" : "text-[#8A8278]"
                        )}
                      >
                        {nav.label}
                      </span>
                      {isSelected && (
                        <span className="ml-auto text-[10px] text-[#3A3630]">↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Loading spinner */}
            {!isQuickNav && loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 rounded-full border-2 border-[#F5B942]/20 border-t-[#F5B942] animate-spin" />
              </div>
            )}

            {/* Transaction results */}
            {!isQuickNav && !loading && results.length > 0 && (
              <div className="py-1">
                <p className="px-5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                  Transactions
                </p>
                {results.map((txn, i) => {
                  const isSelected = selected === i;
                  const displayName = txn.merchant ?? txn.raw_description;
                  const isExpense = txn.amount > 0;
                  return (
                    <button
                      key={txn.id}
                      data-selected={isSelected}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100",
                        isSelected
                          ? "bg-[rgba(245,185,66,0.07)]"
                          : "hover:bg-white/[0.03]"
                      )}
                    >
                      {/* Date icon */}
                      <span className="flex flex-col items-center justify-center w-7 h-7 rounded-[8px] bg-white/[0.04] shrink-0">
                        <Calendar className="w-[12px] h-[12px] text-[#4A4640]" strokeWidth={1.8} />
                      </span>

                      {/* Merchant + description */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-[13px] font-medium truncate transition-colors duration-100",
                            isSelected ? "text-[#F2EDE8]" : "text-[#9A9188]"
                          )}
                        >
                          {displayName}
                        </p>
                        {txn.raw_description !== displayName && (
                          <p className="text-[11px] text-[#3A3630] truncate leading-tight mt-[1px]">
                            {txn.raw_description}
                          </p>
                        )}
                      </div>

                      {/* Category */}
                      <CategoryBadge category={txn.category} />

                      {/* Amount */}
                      <span
                        className={cn(
                          "text-[13px] font-semibold tabular-nums shrink-0 ml-1",
                          isExpense ? "text-[#F87171]" : "text-[#3DD68C]"
                        )}
                      >
                        {isExpense ? "−" : "+"}{formatAmount(txn.amount)}
                      </span>

                      {/* Date text */}
                      <span className="text-[11px] text-[#3A3630] shrink-0">
                        {formatDate(txn.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!isQuickNav && !loading && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Search className="w-6 h-6 text-[#2C2926]" strokeWidth={1.5} />
                <p className="text-[13px] text-[#3A3630]">No transactions found</p>
              </div>
            )}
          </div>

          {/* ── Footer hint ── */}
          <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center gap-4">
            <span className="text-[10px] text-[#2C2926] flex items-center gap-1">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-px text-[9px]">↑↓</kbd>
              navigate
            </span>
            <span className="text-[10px] text-[#2C2926] flex items-center gap-1">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-px text-[9px]">↵</kbd>
              open
            </span>
            <span className="text-[10px] text-[#2C2926] flex items-center gap-1">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-px text-[9px]">ESC</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
