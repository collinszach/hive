import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { UpgradeModalProvider } from "@/components/UpgradeModalProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthGuard>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AuthGuard>
      <Toaster />
      <UpgradeModalProvider />
    </>
  );
}
