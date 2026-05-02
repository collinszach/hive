"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Receipt,
  Target,
  TrendingDown,
  CalendarClock,
  Star,
  Zap,
  TrendingUp,
  ArrowDownLeft,
  RefreshCw,
  Settings2,
  BarChart2,
  AlertTriangle,
  CreditCard,
  Bell,
  Search,
  Wallet,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";

// ── Nav structure ──────────────────────────────────────────────

const NAV_PRIMARY = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, exact: true  },
  { href: "/transactions", label: "Transactions", icon: Receipt,         exact: false },
  { href: "/budgets",      label: "Budgets",      icon: Target,          exact: false },
  { href: "/bills",        label: "Bills",        icon: CalendarClock,   exact: false },
] as const;

const NAV_SECONDARY = [
  { href: "/cash-flow",  label: "Cash Flow",  icon: TrendingDown,  exact: false },
  { href: "/position",   label: "Position",   icon: Wallet,        exact: false },
  { href: "/income",     label: "Income",     icon: ArrowDownLeft, exact: false },
  { href: "/points",     label: "Points",     icon: Star,          exact: false },
  { href: "/optimize",   label: "Optimizer",  icon: Zap,           exact: false },
  { href: "/net-worth",  label: "Net Worth",  icon: TrendingUp,    exact: false },
  { href: "/insights",   label: "Insights",   icon: Bell,          exact: false },
  { href: "/reports",    label: "Reports",    icon: BarChart2,     exact: false },
  { href: "/anomalies",  label: "Anomalies",  icon: AlertTriangle, exact: false },
] as const;

// ── IconButton with tooltip ────────────────────────────────────

function NavButton({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex items-center justify-center">
      <Link
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 8,
          transition: "all 0.1s ease",
          color: active
            ? "var(--color-honey-bright)"
            : hovered
            ? "var(--color-ink-secondary)"
            : "var(--color-ink-ghost)",
          background: active
            ? "rgba(201,146,14,0.10)"
            : hovered
            ? "rgba(255,255,255,0.04)"
            : "transparent",
          borderLeft: active ? "2px solid var(--color-honey)" : "2px solid transparent",
        }}
      >
        <Icon
          size={16}
          strokeWidth={active ? 2.1 : 1.8}
        />
        {badge != null && badge > 0 && (
          <span style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            background: "var(--color-honey)",
            color: "#0B0C0F",
            fontSize: 8,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
          }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            left: "calc(100% + 10px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "#1A1B21",
            border: "1px solid var(--border-strong)",
            color: "var(--color-ink-primary)",
            fontSize: 11,
            fontWeight: 500,
            padding: "5px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [userInitial, setUserInitial] = useState("?");
  const [unreadCount, setUnreadCount] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.username && setUserInitial(d.username[0].toUpperCase()))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function refresh() {
      api.insights.list(1).then((d) => setUnreadCount(d.unread_count)).catch(() => {});
      api.anomalies.list("unreviewed").then((d) => setAnomalyCount(d.length)).catch(() => {});
    }
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/plaid/sync-now", { method: "POST", credentials: "include" });
      if (res.ok) {
        toast.success("Sync started — transactions will update shortly");
      } else {
        toast.warning("Sync request sent, check back in a moment");
      }
    } catch {
      toast.error("Sync failed — check your connection");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 52,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--border-default)",
        zIndex: 40,
        paddingTop: 0,
      }}
    >
      {/* ── Logo ────────────────────────────────────────────── */}
      <Link
        href="/dashboard"
        title="Dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 7,
          background: "var(--color-honey)",
          marginTop: 14,
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        {/* Hex mark */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" stroke="#0B0C0F" strokeWidth="1.5" fill="none" />
          <polygon points="8,4 11.5,6 11.5,10 8,12 4.5,10 4.5,6" stroke="#0B0C0F" strokeWidth="1" fill="#0B0C0F" opacity="0.35" />
          <circle cx="8" cy="8" r="1.2" fill="#0B0C0F" />
        </svg>
      </Link>

      {/* ── Primary nav ─────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          width: "100%",
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {NAV_PRIMARY.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <NavButton key={href} href={href} label={label} icon={icon} active={active} />
          );
        })}
      </nav>

      {/* ── Divider ─────────────────────────────────────────── */}
      <div
        style={{
          width: "calc(100% - 16px)",
          height: 1,
          background: "var(--border-subtle)",
          margin: "6px 8px",
          flexShrink: 0,
        }}
      />

      {/* ── Secondary nav ───────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          width: "100%",
          paddingLeft: 8,
          paddingRight: 8,
          flex: 1,
        }}
      >
        {NAV_SECONDARY.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const badge =
            href === "/insights"  && unreadCount  > 0 ? unreadCount  :
            href === "/anomalies" && anomalyCount  > 0 ? anomalyCount :
            undefined;
          return (
            <NavButton key={href} href={href} label={label} icon={icon} active={active} badge={badge} />
          );
        })}
      </nav>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          paddingBottom: 14,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {/* Search / Command Palette */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("hive:cmd-k"))}
          title="Search (⌘K)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "var(--color-ink-ghost)",
            cursor: "pointer",
            transition: "all 0.1s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-ghost)";
          }}
        >
          <Search size={16} strokeWidth={1.8} />
        </button>

        {/* Sync */}
        <button
          onClick={handleSync}
          disabled={syncing}
          title="Sync accounts"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: syncing ? "var(--color-honey-bright)" : "var(--color-ink-ghost)",
            cursor: syncing ? "not-allowed" : "pointer",
            transition: "all 0.1s ease",
          }}
          onMouseEnter={(e) => {
            if (!syncing) {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-secondary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!syncing) {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-ghost)";
            }
          }}
        >
          <RefreshCw
            size={16}
            strokeWidth={1.8}
            style={{
              animation: syncing ? "spin 1s linear infinite" : "none",
            }}
          />
        </button>

        {/* Settings */}
        <NavButton href="/settings" label="Settings" icon={Settings2} active={pathname.startsWith("/settings")} />

        {/* Avatar → account page */}
        <Link
          href="/account"
          title="Account"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: pathname.startsWith("/account") ? "var(--color-honey-bright)" : "var(--color-honey)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "#0B0C0F",
            flexShrink: 0,
            marginTop: 2,
            textDecoration: "none",
            outline: pathname.startsWith("/account") ? "2px solid var(--color-honey)" : "none",
            outlineOffset: 2,
          }}
        >
          {userInitial}
        </Link>
      </div>

      {/* Spin keyframe for sync button */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  );
}
