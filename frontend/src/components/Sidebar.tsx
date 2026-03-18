"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Hexagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/transactions", label: "Transactions", icon: Receipt, exact: false },
  { href: "/budgets", label: "Budgets", icon: Target, exact: false },
  { href: "/optimize", label: "Optimizer", icon: Zap, exact: false },
  { href: "/points", label: "Points", icon: Star, exact: false },
  { href: "/net-worth", label: "Net Worth", icon: TrendingUp, exact: false },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle, exact: false },
  { href: "/chat", label: "AI Chat", icon: MessageSquare, exact: false },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-slate-900 border-r border-slate-800 z-10">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Hexagon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">Hive Finance</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-indigo-400" : "text-slate-500"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-800">
        <Link
          href="/connect"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0 text-slate-500" />
          Connect Account
        </Link>
      </div>
    </aside>
  );
}
