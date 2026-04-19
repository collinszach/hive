import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { UpgradeModalProvider } from "@/components/UpgradeModalProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base text-ink-primary flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-h-screen p-7">
        <div className="max-w-7xl mx-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <Toaster />
      <UpgradeModalProvider />
    </div>
  );
}
