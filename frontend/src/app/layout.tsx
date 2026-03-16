import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hive — Personal Finance",
  description: "Self-hosted personal finance intelligence platform",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/optimize", label: "Optimizer" },
  { href: "/points", label: "Points" },
  { href: "/net-worth", label: "Net Worth" },
  { href: "/anomalies", label: "Anomalies" },
  { href: "/chat", label: "Chat" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-indigo-400">
              Hive
            </Link>
            <nav className="flex gap-5">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
