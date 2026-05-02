import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { UpgradeModalProvider } from "@/components/UpgradeModalProvider";
import Sidebar from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import InstallPrompt from "@/components/InstallPrompt";
import { FloatingChat } from "@/components/FloatingChat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthGuard>
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-base)" }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0, overflow: "auto", paddingLeft: 52 }}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </AuthGuard>
      <CommandPalette />
      <FloatingChat />
      <Toaster />
      <InstallPrompt />
      <UpgradeModalProvider />
    </>
  );
}
