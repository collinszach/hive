"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Send, Sparkles, ArrowUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  model_used?: string;
}

const SUGGESTED = [
  "Am I on track with my spending this month?",
  "What's my best card to use for groceries?",
  "How much did I spend on food last month?",
  "Which categories am I over budget in?",
  "What's my net worth trend looking like?",
];

// ── Typing dots ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink-tertiary"
          style={{
            animation: "dotPulse 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Message Bubble ───────────────────────────────────────────────────────

function modelLabel(model_used: string): string {
  if (model_used.startsWith("ollama/")) return `local · ${model_used.replace("ollama/", "")}`;
  if (model_used === "claude-sonnet-4-6") return "claude · sonnet";
  return model_used;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-honey" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-honey/[0.12] border border-honey/20 text-ink-primary rounded-br-sm"
              : "bg-surface border border-white/[0.06] text-ink-primary rounded-bl-sm"
          }`}
        >
          {msg.content}
        </div>
        {!isUser && msg.model_used && (
          <p className="text-[10px] text-ink-tertiary/40 pl-1">{modelLabel(msg.model_used)}</p>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);
  const [useClaude, setUseClaude] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const history = messages;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await api.chat.send(
        userMsg.content,
        history.map((m) => ({ role: m.role, content: m.content })),
        useClaude,
      );
      setMessages((prev) => {
        const updated = [...prev, { role: "assistant" as const, content: res.response, model_used: res.model_used }];
        return updated.length > 50 ? updated.slice(-50) : updated;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      if (msg.includes("503") && !useClaude) {
        setError("Local AI unavailable — try Claude");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-honey/[0.1] border border-honey/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-honey" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-primary">Insights</h1>
            <p className="text-[11px] text-ink-tertiary">
              {useClaude ? "Claude Sonnet" : "Local · qwen2.5:7b"} · Enter to send
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Violet ambient header band ──────────────────────────────── */}
      <div className="relative px-5 py-4 border-b border-white/[0.05] overflow-hidden"
           style={{ background: "linear-gradient(160deg, rgba(167,139,250,0.07) 0%, transparent 60%)" }}>
        <div aria-hidden className="pointer-events-none absolute -top-8 -left-4 w-48 h-24 rounded-full"
             style={{ background: "radial-gradient(ellipse, rgba(167,139,250,0.18) 0%, transparent 70%)" }} />
        <p className="relative text-[9px] font-bold tracking-[0.14em] uppercase text-[#A78BFA]">AI Financial Advisor</p>
        <p className="relative text-[14px] font-semibold text-ink-primary mt-0.5">Ask me anything about your finances</p>
      </div>

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="max-w-lg mx-auto space-y-2 animate-slide-up">
            <p className="hive-label text-center mb-5">Suggested</p>
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="block w-full text-left px-4 py-3 rounded-xl hive-card
                           text-[13px] text-ink-secondary
                           hover:border-honey/20 hover:text-ink-primary hover:bg-honey/[0.03]
                           transition-all duration-150"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-honey" />
            </div>
            <div className="bg-surface border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-semantic-expense text-[13px] bg-semantic-expense/[0.08]
                          border border-semantic-expense/20 rounded-xl px-4 py-3">
            {error}
            {error === "Local AI unavailable — try Claude" && !useClaude && (
              <button
                onClick={() => { setUseClaude(true); setError(null); }}
                className="block mx-auto mt-2 text-[12px] text-honey underline hover:no-underline"
              >
                Switch to Claude instead
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-white/[0.05]">
        <form onSubmit={handleSubmit} className="flex gap-2.5 items-end">
          {/* Model toggle */}
          <div className="flex items-center gap-1 bg-elevated border border-white/[0.06] rounded-xl p-1 shrink-0 self-end mb-0.5">
            <button
              type="button"
              onClick={() => setUseClaude(false)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                !useClaude
                  ? "bg-honey/[0.15] text-honey"
                  : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => setUseClaude(true)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                useClaude
                  ? "bg-honey/[0.15] text-honey"
                  : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              Claude
            </button>
          </div>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances…"
              rows={1}
              className="w-full bg-surface border border-white/[0.08] rounded-xl px-4 py-3 text-[13px]
                         text-ink-primary placeholder-ink-tertiary/50
                         focus:outline-none focus:border-honey/40 focus:ring-1 focus:ring-honey/10
                         transition-all duration-150"
              style={{ resize: "none", overflowY: "auto", maxHeight: "120px" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-150
              ${loading || !input.trim()
                ? "bg-elevated border border-white/[0.06] text-ink-tertiary"
                : "bg-honey text-[#0B0B0C] shadow-honey-sm hover:bg-honey-deep"
              }`}
          >
            {loading
              ? <div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin" />
              : <ArrowUp className="w-4 h-4" />
            }
          </button>
        </form>
        <p className="text-[10px] text-ink-tertiary/40 text-center mt-2">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
