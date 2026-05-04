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
  Target,
  Flag,
  Repeat2,
  CalendarClock,
  TrendingUp,
  ArrowDownLeft,
  BookOpen,
  Store,
  BarChart2,
  AlertTriangle,
  FileText,
  Landmark,
  CreditCard,
  Shield,
  Bell,
  RefreshCw,
  Sparkles,
  Download,
} from "lucide-react";
import { api, Transaction } from "@/lib/api";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";

// ── Open the palette from anywhere ────────────────────────────
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("saplyn:cmd-k"));
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: "primary" | "secondary";
}

// ── All navigable pages ────────────────────────────────────────
const ALL_PAGES: NavItem[] = [
  { label: "Dashboard",      href: "/dashboard",    icon: LayoutDashboard, group: "primary"   },
  { label: "Transactions",   href: "/transactions", icon: Receipt,         group: "primary"   },
  { label: "Cash Flow",      href: "/cash-flow",    icon: ArrowLeftRight,  group: "primary"   },
  { label: "Budgets",        href: "/budgets",      icon: Target,          group: "primary"   },
  { label: "Goals",          href: "/goals",        icon: Flag,            group: "primary"   },
  { label: "Subscriptions",  href: "/subscriptions",icon: Repeat2,         group: "primary"   },
  { label: "Bills",          href: "/bills",        icon: CalendarClock,   group: "primary"   },
  { label: "Income",         href: "/income",       icon: ArrowDownLeft,   group: "secondary" },
  { label: "Points",         href: "/points",       icon: Star,            group: "secondary" },
  { label: "Optimizer",      href: "/optimize",     icon: Zap,             group: "secondary" },
  { label: "Net Worth",      href: "/net-worth",    icon: TrendingUp,      group: "secondary" },
  { label: "Monthly Review", href: "/review",       icon: BookOpen,        group: "secondary" },
  { label: "Merchants",      href: "/merchants",    icon: Store,           group: "secondary" },
  { label: "Rules",          href: "/rules",        icon: Shield,          group: "secondary" },
  { label: "Reports",        href: "/reports",      icon: BarChart2,       group: "secondary" },
  { label: "Anomalies",      href: "/anomalies",    icon: AlertTriangle,   group: "secondary" },
  { label: "Tax",            href: "/tax",          icon: FileText,        group: "secondary" },
  { label: "Debt Payoff",    href: "/debt",         icon: CreditCard,      group: "secondary" },
  { label: "Plan",           href: "/plan",         icon: Landmark,        group: "secondary" },
  { label: "Insights",       href: "/insights",     icon: Bell,            group: "secondary" },
  { label: "AI Chat",        href: "/chat",         icon: MessageSquare,   group: "secondary" },
];

// ── Quick actions ─────────────────────────────────────────────
interface ActionItem {
  label: string;
  description: string;
  icon: React.ElementType;
  keywords: string[];
  action: () => Promise<void>;
}

const QUICK_ACTIONS: ActionItem[] = [
  {
    label: "Sync Accounts",
    description: "Pull latest transactions from all linked accounts",
    icon: RefreshCw,
    keywords: ["sync", "refresh", "pull", "update", "accounts"],
    action: async () => {
      const res = await fetch("/api/plaid/sync-now", { method: "POST", credentials: "include" });
      if (res.ok) {
        toast.success("Sync started — transactions will update shortly");
      } else {
        toast.warning("Sync request sent, check back in a moment");
      }
    },
  },
  {
    label: "Generate Insights",
    description: "Run AI analysis on your recent spending patterns",
    icon: Sparkles,
    keywords: ["insights", "ai", "analysis", "generate", "analyze"],
    action: async () => {
      await api.insights.generate();
      toast.success("Insights generation started");
    },
  },
  {
    label: "Export Transactions",
    description: "Download all transactions as a CSV file",
    icon: Download,
    keywords: ["export", "download", "csv", "transactions"],
    action: async () => {
      window.location.href = "/api/transactions/export";
    },
  },
];

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

  const trimmed    = query.trim();
  const isQuickNav = trimmed.length === 0;

  // When typing: filter pages and actions by label/keyword match
  const pageMatches: NavItem[] = isQuickNav
    ? []
    : ALL_PAGES.filter((p) => p.label.toLowerCase().includes(trimmed.toLowerCase()));

  const actionMatches: ActionItem[] = isQuickNav
    ? []
    : QUICK_ACTIONS.filter((a) =>
        a.label.toLowerCase().includes(trimmed.toLowerCase()) ||
        a.keywords.some((k) => k.includes(trimmed.toLowerCase()))
      );

  // Total navigable items: all pages + actions (when empty) OR matches + transaction results
  const totalItems = isQuickNav
    ? ALL_PAGES.length + QUICK_ACTIONS.length
    : pageMatches.length + actionMatches.length + results.length;

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
    window.addEventListener("saplyn:cmd-k", onCustomEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("saplyn:cmd-k", onCustomEvent);
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

  // ── Navigation / action handler ───────────────────────────
  function handleSelect(index: number) {
    if (isQuickNav) {
      if (index < ALL_PAGES.length) {
        const page = ALL_PAGES[index];
        if (page) { router.push(page.href); closePalette(); }
      } else {
        const action = QUICK_ACTIONS[index - ALL_PAGES.length];
        if (action) {
          closePalette();
          action.action().catch(() => toast.error(`${action.label} failed`));
        }
      }
    } else {
      if (index < pageMatches.length) {
        const page = pageMatches[index];
        if (page) { router.push(page.href); closePalette(); }
      } else if (index < pageMatches.length + actionMatches.length) {
        const action = actionMatches[index - pageMatches.length];
        if (action) {
          closePalette();
          action.action().catch(() => toast.error(`${action.label} failed`));
        }
      } else {
        const txn = results[index - pageMatches.length - actionMatches.length];
        if (txn) {
          const merchant = txn.merchant ?? txn.raw_description;
          router.push(`/transactions?search=${encodeURIComponent(merchant)}&search_all=true&open_tx=${txn.id}`);
          closePalette();
        }
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
            style={{ maxHeight: 400 }}
          >
            {/* Quick nav — all pages, grouped + actions */}
            {isQuickNav && (
              <div className="py-1">
                {(["primary", "secondary"] as const).map((group) => {
                  const groupPages = ALL_PAGES.filter((p) => p.group === group);
                  const groupOffset = group === "secondary" ? ALL_PAGES.filter((p) => p.group === "primary").length : 0;
                  const groupLabel = group === "primary" ? "Main" : "More";
                  return (
                    <div key={group}>
                      <p className="px-5 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                        {groupLabel}
                      </p>
                      {groupPages.map((nav, gi) => {
                        const i = groupOffset + gi;
                        const Icon = nav.icon;
                        const isSelected = selected === i;
                        return (
                          <button
                            key={nav.href}
                            data-selected={isSelected}
                            onClick={() => handleSelect(i)}
                            onMouseEnter={() => setSelected(i)}
                            className={cn(
                              "w-full flex items-center gap-3 px-5 py-2 text-left transition-colors duration-100",
                              isSelected
                                ? "bg-[rgba(122,184,138,0.07)]"
                                : "hover:bg-white/[0.03]"
                            )}
                          >
                            <span
                              className={cn(
                                "flex items-center justify-center w-6 h-6 rounded-[7px] shrink-0 transition-colors duration-100",
                                isSelected
                                  ? "bg-[rgba(122,184,138,0.14)] text-[#7AB88A]"
                                  : "bg-white/[0.04] text-[#4A4640]"
                              )}
                            >
                              <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} />
                            </span>
                            <span
                              className={cn(
                                "text-[13px] font-medium transition-colors duration-100",
                                isSelected ? "text-[#7AB88A]" : "text-[#8A8278]"
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
                  );
                })}
              </div>
            )}

            {/* Quick nav: Actions section */}
            {isQuickNav && (
              <div>
                <p className="px-5 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                  Actions
                </p>
                {QUICK_ACTIONS.map((action, ai) => {
                  const i = ALL_PAGES.length + ai;
                  const isSelected = selected === i;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      data-selected={isSelected}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2 text-left transition-colors duration-100",
                        isSelected ? "bg-[rgba(122,184,138,0.07)]" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-[7px] shrink-0 transition-colors duration-100",
                        isSelected ? "bg-[rgba(122,184,138,0.14)] text-[#7AB88A]" : "bg-white/[0.04] text-[#4A4640]"
                      )}>
                        <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-[13px] font-medium transition-colors duration-100",
                          isSelected ? "text-[#7AB88A]" : "text-[#8A8278]"
                        )}>
                          {action.label}
                        </span>
                        <p className="text-[11px] text-[#3A3630] truncate">{action.description}</p>
                      </div>
                      {isSelected && <span className="ml-auto text-[10px] text-[#3A3630] shrink-0">↵</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Page matches when typing */}
            {!isQuickNav && pageMatches.length > 0 && (
              <div className="py-1">
                <p className="px-5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                  Pages
                </p>
                {pageMatches.map((nav, i) => {
                  const Icon = nav.icon;
                  const isSelected = selected === i;
                  return (
                    <button
                      key={nav.href}
                      data-selected={isSelected}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2 text-left transition-colors duration-100",
                        isSelected ? "bg-[rgba(122,184,138,0.07)]" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-[7px] shrink-0 transition-colors duration-100",
                        isSelected ? "bg-[rgba(122,184,138,0.14)] text-[#7AB88A]" : "bg-white/[0.04] text-[#4A4640]"
                      )}>
                        <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} />
                      </span>
                      <span className={cn(
                        "text-[13px] font-medium transition-colors duration-100",
                        isSelected ? "text-[#7AB88A]" : "text-[#8A8278]"
                      )}>
                        {nav.label}
                      </span>
                      {isSelected && <span className="ml-auto text-[10px] text-[#3A3630]">↵</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action matches when typing */}
            {!isQuickNav && actionMatches.length > 0 && (
              <div className="py-1">
                <p className="px-5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                  Actions
                </p>
                {actionMatches.map((action, ai) => {
                  const i = pageMatches.length + ai;
                  const isSelected = selected === i;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      data-selected={isSelected}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2 text-left transition-colors duration-100",
                        isSelected ? "bg-[rgba(122,184,138,0.07)]" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-[7px] shrink-0 transition-colors duration-100",
                        isSelected ? "bg-[rgba(122,184,138,0.14)] text-[#7AB88A]" : "bg-white/[0.04] text-[#4A4640]"
                      )}>
                        <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-[13px] font-medium transition-colors duration-100",
                          isSelected ? "text-[#7AB88A]" : "text-[#8A8278]"
                        )}>
                          {action.label}
                        </span>
                        <p className="text-[11px] text-[#3A3630] truncate">{action.description}</p>
                      </div>
                      {isSelected && <span className="ml-auto text-[10px] text-[#3A3630] shrink-0">↵</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Loading spinner */}
            {!isQuickNav && loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 rounded-full border-2 border-[#7AB88A]/20 border-t-[#7AB88A] animate-spin" />
              </div>
            )}

            {/* Transaction results */}
            {!isQuickNav && !loading && results.length > 0 && (
              <div className="py-1">
                <p className="px-5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3A3630]">
                  Transactions
                </p>
                {results.map((txn, i) => {
                  const absIdx = pageMatches.length + actionMatches.length + i;
                  const isSelected = selected === absIdx;
                  const displayName = txn.merchant ?? txn.raw_description;
                  const isExpense = txn.amount > 0;
                  return (
                    <button
                      key={txn.id}
                      data-selected={isSelected}
                      onClick={() => handleSelect(absIdx)}
                      onMouseEnter={() => setSelected(absIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100",
                        isSelected
                          ? "bg-[rgba(122,184,138,0.07)]"
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
            {!isQuickNav && !loading && results.length === 0 && pageMatches.length === 0 && actionMatches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Search className="w-6 h-6 text-[#2C2926]" strokeWidth={1.5} />
                <p className="text-[13px] text-[#3A3630]">No results found</p>
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
              select
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
