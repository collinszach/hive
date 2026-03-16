import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";
import { SignOutButton } from "@/components/SignOutButton";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <SessionProvider session={session}>
          {session && (
            <header className="border-b border-gray-800 bg-gray-900">
              <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3">
                <Link href="/" className="text-lg font-bold tracking-tight text-indigo-400">
                  Hive
                </Link>
                <nav className="flex gap-5 flex-1">
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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">{session.user?.email}</span>
                  <SignOutButton />
                </div>
              </div>
            </header>
          )}
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
