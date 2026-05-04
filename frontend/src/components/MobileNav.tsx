"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Target, CalendarClock, MoreHorizontal } from "lucide-react";
import { useState } from "react";

const MOBILE_NAV = [
  { href: "/dashboard",    label: "Home",         icon: LayoutDashboard, exact: true  },
  { href: "/transactions", label: "Transactions", icon: Receipt,         exact: false },
  { href: "/budgets",      label: "Budgets",      icon: Target,          exact: false },
  { href: "/bills",        label: "Bills",        icon: CalendarClock,   exact: false },
];

const MORE_NAV = [
  { href: "/cash-flow",  label: "Cash Flow"  },
  { href: "/income",     label: "Income"     },
  { href: "/net-worth",  label: "Net Worth"  },
  { href: "/points",     label: "Points"     },
  { href: "/optimize",   label: "Optimizer"  },
  { href: "/insights",   label: "Insights"   },
  { href: "/reports",    label: "Reports"    },
  { href: "/anomalies",  label: "Anomalies"  },
  { href: "/settings",   label: "Settings"   },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More drawer */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setShowMore(false)}
          />
          <div
            className="fixed bottom-14 left-0 right-0 z-50 md:hidden rounded-t-2xl border-t"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--border-strong)",
            }}
          >
            <div className="grid grid-cols-3 gap-px p-4">
              {MORE_NAV.map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setShowMore(false)}
                    className="flex items-center justify-center py-3 px-2 rounded-xl text-[12px] font-medium"
                    style={{
                      color: active ? "#4A7A5A" : "var(--color-ink-secondary)",
                      background: active ? "rgba(74,122,90,0.08)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--border-default)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {MOBILE_NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]"
              style={{ color: active ? "#4A7A5A" : "var(--color-ink-ghost)" }}
            >
              <Icon size={20} strokeWidth={active ? 2.1 : 1.8} />
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore((s) => !s)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]"
          style={{ color: showMore ? "#4A7A5A" : "var(--color-ink-ghost)" }}
        >
          <MoreHorizontal size={20} strokeWidth={1.8} />
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>More</span>
        </button>
      </nav>
    </>
  );
}
