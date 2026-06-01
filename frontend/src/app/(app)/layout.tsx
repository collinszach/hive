import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { UpgradeModalProvider } from "@/components/UpgradeModalProvider";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { CommandPalette } from "@/components/CommandPalette";
import InstallPrompt from "@/components/InstallPrompt";
import { FloatingChat } from "@/components/FloatingChat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthGuard>
        <div style={{ display: "flex", minHeight: "100dvh", background: "var(--color-base)" }}>
          <Sidebar />
          {/* lg:pl-[220px] = sidebar width on desktop.
              Bottom pad clears the fixed MobileNav (≈4rem) + the home
              indicator (safe-area-inset-bottom) on mobile; removed on lg. */}
          <main
            style={{ flex: 1, minWidth: 0, overflow: "auto" }}
            className="lg:pl-[220px] pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
          >
            {/* Top pad clears the notch / Dynamic Island; reset on desktop. */}
            <div className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] md:px-6 md:pb-6 md:pt-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
        <MobileNav />
      </AuthGuard>
      <CommandPalette />
      <FloatingChat />
      <Toaster />
      <InstallPrompt />
      <UpgradeModalProvider />
    </>
  );
}
