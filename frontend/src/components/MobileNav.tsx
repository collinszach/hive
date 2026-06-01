"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Target, Sparkles, MoreHorizontal } from "lucide-react";
import { useState } from "react";

/* Section route sets — the spec IA (Home · Money · Plan · Insights · Connect).
   A primary tab lights up for any route within its section, and the grouped
   "More" sheet exposes every sibling so nothing is unreachable on mobile. */
const SECTIONS = {
  money:    ["/transactions", "/bills", "/income", "/subscriptions", "/cash-flow", "/merchants", "/rules"],
  plan:     ["/budgets", "/goals", "/debt", "/net-worth", "/position", "/plan", "/points", "/optimize"],
  insights: ["/insights", "/reports", "/review", "/anomalies", "/chat"],
  connect:  ["/connect", "/settings", "/account", "/security", "/billing"],
};

const MOBILE_NAV = [
  { href: "/dashboard",    label: "Home",     icon: LayoutDashboard, match: (p: string) => p === "/dashboard" },
  { href: "/transactions", label: "Money",    icon: Receipt,         match: (p: string) => SECTIONS.money.some((r) => p.startsWith(r)) },
  { href: "/budgets",      label: "Plan",     icon: Target,          match: (p: string) => SECTIONS.plan.some((r) => p.startsWith(r)) },
  { href: "/insights",     label: "Insights", icon: Sparkles,        match: (p: string) => SECTIONS.insights.some((r) => p.startsWith(r)) },
];

/* Everything reachable from the More sheet, grouped by section. */
const MORE_GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  { title: "Money", items: [
    { href: "/bills",         label: "Bills"        },
    { href: "/income",        label: "Income"       },
    { href: "/subscriptions", label: "Subscriptions" },
    { href: "/cash-flow",     label: "Cash Flow"    },
    { href: "/merchants",     label: "Merchants"    },
    { href: "/rules",         label: "Rules"        },
  ]},
  { title: "Plan", items: [
    { href: "/goals",     label: "Goals"     },
    { href: "/debt",      label: "Debt"      },
    { href: "/net-worth", label: "Net Worth" },
    { href: "/position",  label: "Holdings"  },
    { href: "/plan",      label: "Plan"      },
    { href: "/points",    label: "Points"    },
    { href: "/optimize",  label: "Optimizer" },
  ]},
  { title: "Insights", items: [
    { href: "/reports",   label: "Reports"   },
    { href: "/review",    label: "Review"    },
    { href: "/anomalies", label: "Anomalies" },
    { href: "/chat",      label: "Assistant" },
  ]},
  { title: "Connect", items: [
    { href: "/connect",  label: "Accounts" },
    { href: "/settings", label: "Settings" },
    { href: "/account",  label: "Profile"  },
    { href: "/security", label: "Security" },
    { href: "/billing",  label: "Billing"  },
  ]},
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
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setShowMore(false)}
          />
          <div
            className="fixed left-0 right-0 z-50 lg:hidden rounded-t-2xl border-t max-h-[70dvh] overflow-y-auto"
            style={{
              bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
              background: "var(--color-surface)",
              borderColor: "var(--border-strong)",
            }}
          >
            <div className="mx-auto my-2 h-1 w-9 rounded-full" style={{ background: "var(--border-strong)" }} />
            <div className="px-4 pb-4 space-y-4">
              {MORE_GROUPS.map(({ title, items }) => (
                <div key={title}>
                  <div className="hive-label mb-1.5 px-1">{title}</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {items.map(({ href, label }) => {
                      const active = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setShowMore(false)}
                          className="flex items-center justify-center text-center min-h-[44px] py-2 px-2 rounded-xl text-[12px] font-medium active:scale-[0.97] transition-transform"
                          style={{
                            color: active ? "#3B82F6" : "var(--color-ink-secondary)",
                            background: active ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)",
                          }}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--border-default)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {MOBILE_NAV.map(({ href, label, icon: Icon, match }) => {
          const active = !showMore && match(pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setShowMore(false)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] active:opacity-60 transition-opacity"
              style={{ color: active ? "#3B82F6" : "var(--color-ink-ghost)" }}
            >
              <Icon size={20} strokeWidth={active ? 2.1 : 1.8} />
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore((s) => !s)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] active:opacity-60 transition-opacity"
          style={{ color: showMore ? "#3B82F6" : "var(--color-ink-ghost)" }}
        >
          <MoreHorizontal size={20} strokeWidth={1.8} />
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.03em" }}>More</span>
        </button>
      </nav>
    </>
  );
}
