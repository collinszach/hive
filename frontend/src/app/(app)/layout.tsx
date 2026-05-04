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
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-base)" }}>
          <Sidebar />
          {/* md:pl-[52px] = sidebar width on desktop; pb-16 = bottom nav on mobile */}
          <main
            style={{ flex: 1, minWidth: 0, overflow: "auto" }}
            className="md:pl-[220px] pb-16 md:pb-0"
          >
            <div className="px-4 md:px-8 py-4">
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
