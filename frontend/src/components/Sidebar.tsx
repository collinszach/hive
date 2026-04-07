"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Target,
  Zap,
  Star,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Shield,
  UserCircle,
  LogOut,
  ArrowLeftRight,
  Repeat2,
  Store,
  Flag,
  BarChart3,
  Settings2,
  CheckCircle2,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/auth";

// ── Navigation structure ──────────────────────────────────────

const NAV_GROUPS = [
  {
    id: "home",
    label: null,
    items: [
      { href: "/",            label: "Dashboard",     icon: LayoutDashboard, exact: true  },
    ],
  },
  {
    id: "track",
    label: "FINANCES",
    items: [
      { href: "/transactions",  label: "Transactions",  icon: Receipt,        exact: false },
      { href: "/budgets",       label: "Budgets",       icon: Target,         exact: false },
      { href: "/cash-flow",     label: "Cash Flow",     icon: ArrowLeftRight, exact: false },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat2,        exact: false },
      { href: "/goals",         label: "Goals",         icon: Flag,           exact: false },
      { href: "/plan",          label: "Planning",      icon: TrendingUp,     exact: false },
    ],
  },
  {
    id: "optimize",
    label: "INTELLIGENCE",
    items: [
      { href: "/optimize",   label: "Optimizer",  icon: Zap,          exact: false },
      { href: "/points",     label: "Points",     icon: Star,         exact: false },
      { href: "/net-worth",  label: "Net Worth",  icon: TrendingUp,   exact: false },
      { href: "/merchants",  label: "Merchants",  icon: Store,        exact: false },
      { href: "/reports",    label: "Reports",    icon: BarChart3,    exact: false },
      { href: "/anomalies",  label: "Anomalies",  icon: AlertTriangle, exact: false },
      { href: "/tax",        label: "Tax Calculator", icon: Calculator,    exact: false },
      { href: "/chat",       label: "AI Chat",    icon: MessageSquare, exact: false },
    ],
  },
] as const;

const NAV_FOOTER = [
  { href: "/settings", label: "Settings", icon: Settings2  },
  { href: "/connect",  label: "Connect",  icon: PlusCircle },
  { href: "/security", label: "Security", icon: Shield     },
  { href: "/account",  label: "Account",  icon: UserCircle },
] as const;

// ── NavItem ───────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2.5 px-3 py-[6px] rounded-[9px]",
        "text-[13px] font-medium transition-all duration-150",
        active
          ? [
              "text-[#F5B942]",
              "bg-[rgba(245,185,66,0.08)]",
            ].join(" ")
          : "text-[#7A7268] hover:text-[#C8BFB4] hover:bg-[rgba(245,185,66,0.04)]"
      )}
    >
      {/* Active left bar */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[18px] rounded-r-full"
          style={{
            background: "linear-gradient(180deg, #FFD166 0%, #F5B942 100%)",
            boxShadow: "0 0 8px rgba(245,185,66,0.5)",
          }}
        />
      )}

      <Icon
        className={cn(
          "w-[14px] h-[14px] shrink-0 transition-colors duration-150",
          active ? "text-[#F5B942]" : "text-[#4A4640] group-hover:text-[#8A8278]"
        )}
        strokeWidth={active ? 2.2 : 1.8}
      />

      <span className="leading-none tracking-[-0.01em]">{label}</span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  function handleLogout() {
    clearToken();
    window.location.href = "/login";
  }

  async function handleSync() {
    setSyncing(true);
    setSyncDone(false);
    try {
      await fetch("/api/plaid/sync-now", { method: "POST" });
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }

  return (
    <aside
      className="w-[210px] shrink-0 h-screen sticky top-0 flex flex-col z-10"
      style={{
        background: "#09090E",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* ── Ambient amber glow at top ─────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-[180px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 160% 100% at 50% 0%, rgba(245,185,66,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── Brand mark ───────────────────────────────────── */}
      <div
        className="relative px-4 pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
      >
        <Link href="/" className="flex items-center gap-3 group">
          {/* Honeycomb hex mark */}
          <div
            className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-[10px]"
            style={{
              background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
              boxShadow: "0 0 0 1px rgba(245,185,66,0.4), 0 4px 16px rgba(245,185,66,0.30), 0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              {/* Outer hex */}
              <path
                d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
                fill="rgba(9,8,7,0.75)"
              />
              {/* Inner hex */}
              <path
                d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z"
                fill="rgba(245,185,66,0.35)"
              />
              {/* Center dot */}
              <circle cx="12" cy="12" r="2" fill="rgba(9,8,7,0.9)" />
              <circle cx="12" cy="12" r="1" fill="rgba(245,185,66,0.95)" />
            </svg>
          </div>

          <div>
            <p
              className="text-[15px] font-bold tracking-[0.04em] text-[#F2EDE8]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
            >
              HIVE
            </p>
            <p className="text-[9.5px] tracking-[0.12em] uppercase text-[#4A4640] mt-[1px]">
              Finance
            </p>
          </div>
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="relative flex-1 px-2.5 py-3 overflow-y-auto space-y-[2px]">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.id} className={gi > 0 ? "mt-3" : ""}>
            {/* Section label */}
            {group.label && (
              <p
                className="px-3 pb-1.5 text-[9.5px] font-semibold tracking-[0.14em]"
                style={{ color: "#3A3630" }}
              >
                {group.label}
              </p>
            )}

            {/* Nav items */}
            {group.items.map(({ href, label, icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <NavItem
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={active}
                />
              );
            })}

            {/* Group separator (except last) */}
            {gi < NAV_GROUPS.length - 1 && (
              <div
                className="mx-3 mt-3"
                style={{ height: "1px", background: "rgba(255,255,255,0.04)" }}
              />
            )}
          </div>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────── */}
      <div
        className="px-2.5 py-3 space-y-[2px]"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
      >
        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-[6px] rounded-[9px]",
            "text-[13px] font-medium transition-all duration-150",
            syncDone
              ? "text-[#3DD68C] bg-[rgba(61,214,140,0.07)]"
              : "text-[#7A7268] hover:text-[#C8BFB4] hover:bg-[rgba(245,185,66,0.04)] disabled:opacity-40"
          )}
        >
          {syncDone ? (
            <CheckCircle2 className="w-[14px] h-[14px] shrink-0 text-[#3DD68C]" strokeWidth={2} />
          ) : (
            <RefreshCw
              className={cn(
                "w-[14px] h-[14px] shrink-0 transition-colors",
                syncing ? "animate-spin text-[#F5B942]" : "text-[#4A4640]"
              )}
              strokeWidth={1.8}
            />
          )}
          <span className="leading-none tracking-[-0.01em]">
            {syncing ? "Syncing…" : syncDone ? "Synced!" : "Sync Now"}
          </span>
        </button>

        {/* Footer nav items */}
        {NAV_FOOTER.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return <NavItem key={href} href={href} label={label} icon={Icon} active={active} />;
        })}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-[6px] rounded-[9px]
                     text-[13px] font-medium tracking-[-0.01em]
                     text-[#4A4640] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.06)]
                     transition-all duration-150"
        >
          <LogOut className="w-[14px] h-[14px] shrink-0 text-[#3A3630]" strokeWidth={1.8} />
          <span className="leading-none">Sign out</span>
        </button>

        {/* Footer note */}
        <p className="px-3 pt-1.5 text-[9.5px] tracking-[0.08em] text-[#2C2926]">
          PRIVATE · SELF-HOSTED
        </p>
      </div>
    </aside>
  );
}
