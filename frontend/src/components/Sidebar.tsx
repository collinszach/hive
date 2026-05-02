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
  Bell,
  Search,
  Wallet,
  MessageSquare,
  Flag,
  Calendar,
  Store,
  Filter,
  Link as LinkIcon,
  CreditCard,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";

// ── Nav structure ──────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/chat",      label: "Chat",      icon: MessageSquare },
    ],
  },
  {
    label: "MONEY IN / OUT",
    items: [
      { href: "/transactions",  label: "Transactions",  icon: Receipt },
      { href: "/income",        label: "Income",        icon: ArrowDownLeft },
      { href: "/bills",         label: "Bills",         icon: CalendarClock },
      { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
      { href: "/cash-flow",     label: "Cash Flow",     icon: TrendingDown },
    ],
  },
  {
    label: "PLANNING",
    items: [
      { href: "/budgets", label: "Budgets", icon: Target },
      { href: "/goals",   label: "Goals",   icon: Flag },
      { href: "/debt",    label: "Debt",    icon: TrendingDown },
      { href: "/plan",    label: "Plan",    icon: Calendar },
    ],
  },
  {
    label: "WEALTH",
    items: [
      { href: "/net-worth", label: "Net Worth", icon: TrendingUp },
      { href: "/position",  label: "Position",  icon: Wallet },
      { href: "/reports",   label: "Reports",   icon: BarChart2 },
      { href: "/insights",  label: "Insights",  icon: Bell },
    ],
  },
  {
    label: "REWARDS",
    items: [
      { href: "/points",   label: "Points",   icon: Star },
      { href: "/optimize", label: "Optimize", icon: Zap },
    ],
  },
] as const;

const NAV_BOTTOM = [
  { href: "/merchants", label: "Merchants", icon: Store },
  { href: "/rules",     label: "Rules",     icon: Filter },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { href: "/connect",   label: "Connect",   icon: LinkIcon },
] as const;

// ── NavItem ───────────────────────────────────────────────────

function NavItem({
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
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        padding: "0 10px",
        borderRadius: 7,
        borderLeft: active ? "2px solid #3B82F6" : "2px solid transparent",
        background: active ? "rgba(59,130,246,0.10)" : "transparent",
        color: active ? "#F0F2F5" : "#6B7280",
        fontSize: 13,
        fontWeight: 500,
        textDecoration: "none",
        transition: "all 120ms ease",
        marginLeft: 6,
        marginRight: 6,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "#9CA3AF";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = "#6B7280";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <Icon size={15} strokeWidth={active ? 2.1 : 1.8} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span style={{
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          background: "#3B82F6",
          color: "#fff",
          fontSize: 9,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
          flexShrink: 0,
        }}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
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
      className="hidden md:flex md:flex-col"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 220,
        height: "100vh",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--border-default)",
        zIndex: 40,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* ── Logo + wordmark ─────────────────────────────────── */}
      <Link
        href="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 14px 10px",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        {/* Hex mark */}
        <div style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: "var(--color-honey-bright)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" stroke="#0B0C0F" strokeWidth="1.5" fill="none" />
            <polygon points="8,4 11.5,6 11.5,10 8,12 4.5,10 4.5,6" stroke="#0B0C0F" strokeWidth="1" fill="#0B0C0F" opacity="0.35" />
            <circle cx="8" cy="8" r="1.2" fill="#0B0C0F" />
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", letterSpacing: "-0.02em" }}>
          Hive
        </span>
      </Link>

      {/* ── Main scrollable nav ──────────────────────────────── */}
      <nav style={{ flex: 1, paddingBottom: 8 }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {"label" in section && section.label && (
              <div className="sidebar-section-label">{section.label}</div>
            )}
            {section.items.map(({ href, label, icon }) => {
              const active = href === "/dashboard"
                ? pathname === href
                : pathname.startsWith(href);
              const badge =
                href === "/insights" && unreadCount > 0 ? unreadCount : undefined;
              return (
                <NavItem
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={active}
                  badge={badge}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Divider ─────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px" }} />

      {/* ── Bottom cluster (Merchants / Rules / Anomalies / Connect) ── */}
      <div style={{ paddingTop: 4, paddingBottom: 4 }}>
        {NAV_BOTTOM.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          const badge = href === "/anomalies" && anomalyCount > 0 ? anomalyCount : undefined;
          return (
            <NavItem key={href} href={href} label={label} icon={icon} active={active} badge={badge} />
          );
        })}
      </div>

      {/* ── Divider ─────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px" }} />

      {/* ── Footer: Search / Sync / Settings / Avatar ───────── */}
      <div style={{ padding: "6px 8px 14px" }}>
        {/* Search */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("hive:cmd-k"))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            height: 34,
            padding: "0 10px",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: "#4B5563",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 120ms ease",
            marginLeft: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.color = "#9CA3AF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#4B5563";
          }}
        >
          <Search size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Search</span>
          <span style={{ fontSize: 10, color: "#4B5563" }}>⌘K</span>
        </button>

        {/* Sync */}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            height: 34,
            padding: "0 10px",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: syncing ? "#F5B942" : "#4B5563",
            fontSize: 13,
            fontWeight: 500,
            cursor: syncing ? "not-allowed" : "pointer",
            transition: "all 120ms ease",
            marginLeft: 6,
          }}
          onMouseEnter={(e) => {
            if (!syncing) {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#9CA3AF";
            }
          }}
          onMouseLeave={(e) => {
            if (!syncing) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#4B5563";
            }
          }}
        >
          <RefreshCw
            size={15}
            strokeWidth={1.8}
            style={{ flexShrink: 0, animation: syncing ? "spin 1s linear infinite" : "none" }}
          />
          <span>{syncing ? "Syncing…" : "Sync"}</span>
        </button>

        {/* Settings */}
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings2}
          active={pathname.startsWith("/settings")}
        />

        {/* Billing */}
        <NavItem
          href="/billing"
          label="Billing"
          icon={CreditCard}
          active={pathname.startsWith("/billing")}
        />

        {/* Avatar row */}
        <Link
          href="/account"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 34,
            padding: "0 10px",
            marginLeft: 6,
            borderRadius: 7,
            textDecoration: "none",
            transition: "background 120ms ease",
            background: pathname.startsWith("/account") ? "rgba(59,130,246,0.10)" : "transparent",
            borderLeft: pathname.startsWith("/account") ? "2px solid #3B82F6" : "2px solid transparent",
          }}
        >
          <div style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#F5B942",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#0B0C0F",
            flexShrink: 0,
          }}>
            {userInitial}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: pathname.startsWith("/account") ? "#F0F2F5" : "#6B7280" }}>
            Account
          </span>
        </Link>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </aside>
  );
}
