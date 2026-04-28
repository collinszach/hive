"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Receipt,
  Target,
  Zap,
  Star,
  TrendingUp,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Shield,
  UserCircle,
  LogOut,
  Repeat2,
  BarChart3,
  Settings2,
  CheckCircle2,
  Calculator,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/auth";

// ── Navigation structure ──────────────────────────────────────

const NAV_GROUPS = [
  {
    id: "home",
    label: null,
    items: [
      { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard, exact: true  },
    ],
  },
  {
    id: "track",
    label: "Finances",
    items: [
      { href: "/transactions",  label: "Transactions",  icon: Receipt,  exact: false },
      { href: "/budgets",       label: "Budgets",       icon: Target,   exact: false },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat2,  exact: false },
    ],
  },
  {
    id: "optimize",
    label: "Intelligence",
    items: [
      { href: "/optimize",  label: "Optimizer",      icon: Zap,           exact: false },
      { href: "/points",    label: "Points",         icon: Star,          exact: false },
      { href: "/net-worth", label: "Net Worth",      icon: TrendingUp,    exact: false },
      { href: "/reports",   label: "Reports",        icon: BarChart3,     exact: false },
      { href: "/tax",       label: "Tax",            icon: Calculator,    exact: false },
      { href: "/chat",      label: "AI Chat",        icon: MessageSquare, exact: false },
    ],
  },
] as const;

const NAV_FOOTER = [
  { href: "/settings", label: "Settings", icon: Settings2  },
  { href: "/billing",  label: "Billing",  icon: CreditCard },
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
        "group flex items-center gap-2.5 px-3 py-[6px] rounded-[8px]",
        "text-[12.5px] font-medium transition-all duration-150",
        active
          ? "text-[#F5B942] bg-[rgba(245,185,66,0.10)] border border-[rgba(245,185,66,0.18)]"
          : "text-[#5A6275] border border-transparent hover:text-[#9AA0B0] hover:bg-[rgba(255,255,255,0.05)]"
      )}
    >
      <Icon
        className={cn(
          "w-[14px] h-[14px] shrink-0 transition-colors duration-150",
          active ? "text-[#F5B942]" : "text-[#424860] group-hover:text-[#747D96]"
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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.email && setUserEmail(d.email))
      .catch(() => {});
  }, []);

  const userInitial = userEmail ? userEmail[0].toUpperCase() : "?";

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
      className="w-[204px] shrink-0 h-screen sticky top-0 flex flex-col z-10"
      style={{
        background: "#0F1118",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* ── Brand mark ───────────────────────────────────── */}
      <div
        className="px-4 pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-3 group">
          {/* Honeycomb hex mark */}
          <div
            className="relative w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px]"
            style={{
              background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
              boxShadow: "0 0 0 1px rgba(245,185,66,0.35), 0 3px 12px rgba(245,185,66,0.25), 0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="rgba(9,8,7,0.75)" />
              <path d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z" fill="rgba(245,185,66,0.35)" />
              <circle cx="12" cy="12" r="2" fill="rgba(9,8,7,0.9)" />
              <circle cx="12" cy="12" r="1" fill="rgba(245,185,66,0.95)" />
            </svg>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[14px] font-bold tracking-[0.08em] text-[#E8E4DF]"
              style={{ fontFamily: "var(--font-sans, system-ui)" }}
            >
              HIVE
            </span>
            <span className="text-[9px] tracking-[0.10em] uppercase text-[#3A3F52] font-medium">
              v2
            </span>
          </div>
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-[2px]">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.id} className={gi > 0 ? "mt-4" : ""}>
            {/* Section label */}
            {group.label && (
              <p
                className="px-3 pb-1.5 text-[9px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: "#3A3F52" }}
              >
                {group.label}
              </p>
            )}

            {/* Nav items */}
            <div className="space-y-[2px]">
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
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────── */}
      <div
        className="px-2.5 py-3 space-y-[2px]"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
      >
        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-[6px] rounded-[8px]",
            "text-[12.5px] font-medium transition-all duration-150 border",
            syncDone
              ? "text-[#3DD68C] bg-[rgba(61,214,140,0.07)] border-[rgba(61,214,140,0.14)]"
              : "text-[#505568] border-transparent hover:text-[#8A90A0] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-40"
          )}
        >
          {syncDone ? (
            <CheckCircle2 className="w-[14px] h-[14px] shrink-0 text-[#3DD68C]" strokeWidth={2} />
          ) : (
            <RefreshCw
              className={cn(
                "w-[14px] h-[14px] shrink-0 transition-colors",
                syncing ? "animate-spin text-[#F5B942]" : "text-[#383C4A]"
              )}
              strokeWidth={1.8}
            />
          )}
          <span className="leading-none tracking-[-0.01em]">
            {syncing ? "Syncing…" : syncDone ? "Synced!" : "Sync"}
          </span>
        </button>

        {/* Footer nav items */}
        {NAV_FOOTER.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return <NavItem key={href} href={href} label={label} icon={Icon} active={active} />;
        })}

        {/* User identity + sign out */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] mt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "10px", marginTop: "4px" }}
        >
          {/* Avatar bubble */}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
            style={{
              background: "linear-gradient(135deg, rgba(245,185,66,0.25) 0%, rgba(245,185,66,0.10) 100%)",
              border: "1px solid rgba(245,185,66,0.20)",
              color: "#F5B942",
            }}
          >
            {userInitial}
          </div>

          {/* Email truncated */}
          <span className="flex-1 min-w-0 text-[11px] text-[#5A6275] truncate leading-none">
            {userEmail ?? "—"}
          </span>

          {/* Sign out icon */}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-[6px] border border-transparent
                       text-[#2C2F3A] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.06)]
                       transition-all duration-150"
          >
            <LogOut className="w-3 h-3" strokeWidth={1.8} />
          </button>
        </div>

        {/* Footer note */}
        <p className="px-3 pt-1 text-[9px] tracking-[0.10em] uppercase" style={{ color: "#2E3345" }}>
          Private · Self-hosted
        </p>
      </div>
    </aside>
  );
}
