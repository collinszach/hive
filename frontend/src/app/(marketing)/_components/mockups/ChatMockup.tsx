// src/app/(marketing)/_components/mockups/ChatMockup.tsx
import { Bot } from "lucide-react";

const MESSAGES = [
  {
    role: "user" as const,
    text: "How much did I spend on restaurants last month, and which card should I use?",
  },
  {
    role: "assistant" as const,
    text: "Last month you spent $847 on dining across 23 transactions. Top spots: Nobu ($180), Uchi ($145), Aba ($120).\n\nFor dining, use your Amex Gold — 4× Membership Rewards, worth ~8¢/dollar. On $847 that's about $68 in rewards.",
  },
];

export default function ChatMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Bot className="w-3.5 h-3.5 text-honey" />
        <span className="text-[12px] font-semibold text-ink-primary">AI Chat</span>
        <span
          className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-semibold"
          style={{
            background: "rgba(122,184,138,0.08)",
            color: "#7AB88A",
            border: "1px solid rgba(122,184,138,0.18)",
          }}
        >
          Claude Sonnet
        </span>
      </div>
      {/* Messages */}
      <div className="p-4 space-y-3">
        {MESSAGES.map(({ role, text }, i) => (
          <div key={i} className={`flex gap-2.5 ${role === "user" ? "justify-end" : "justify-start"}`}>
            {role === "assistant" && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: "rgba(122,184,138,0.08)",
                  border: "1px solid rgba(122,184,138,0.18)",
                }}
              >
                <Bot className="w-3 h-3 text-honey" />
              </div>
            )}
            <div
              className="rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed whitespace-pre-line"
              style={{
                maxWidth: "82%",
                background: role === "user" ? "rgba(122,184,138,0.07)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${role === "user" ? "rgba(122,184,138,0.18)" : "rgba(255,255,255,0.07)"}`,
                color: role === "user" ? "#EEEEF0" : "#A0A8B8",
              }}
            >
              {text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
