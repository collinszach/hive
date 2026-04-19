import { Toaster } from "@/components/Toast";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base text-ink-primary">
      {children}
      <Toaster />
    </div>
  );
}
