import { Toaster } from "@/components/Toast";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-base font-geist"
      style={{ color: "var(--color-ink-primary, #ECEEF5)" }}
    >
      {children}
      <Toaster />
    </div>
  );
}
