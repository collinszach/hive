// src/app/(marketing)/_components/TrustBar.tsx
import { Lock, Shield, BookOpen, Eye } from "lucide-react";

const ITEMS = [
  { icon: BookOpen, text: "Bank connections via Plaid" },
  { icon: Eye,    text: "Powered by Claude (Anthropic)" },
  { icon: Lock,   text: "Read-only bank access" },
  { icon: Shield, text: "No ads. No data sold. Ever." },
];

export default function TrustBar() {
  return (
    <div
      className="border-y border-border-subtle py-4 px-6 overflow-x-auto"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <div className="flex items-center justify-center gap-8 min-w-max mx-auto">
        {ITEMS.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-ink-ghost shrink-0" strokeWidth={1.5} />
            <span className="text-[12px] text-ink-ghost whitespace-nowrap">{text}</span>
            {i < ITEMS.length - 1 && (
              <span className="ml-8 w-px h-3 bg-border-subtle" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
