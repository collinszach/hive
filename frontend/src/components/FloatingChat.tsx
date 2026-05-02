"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Sparkles, ArrowUp, X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  model_used?: string;
}

const SUGGESTED = [
  "Am I on track this month?",
  "Best card for groceries?",
  "How much did I spend on food last month?",
  "Which categories am I over budget?",
];

// ── Typing dots ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink-tertiary"
          style={{ animation: "dotPulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

// ── Minimal markdown renderer ──────────────────────────────────────────────

function renderInline(text: string, key?: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index} className="font-semibold text-ink-primary">{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4] !== undefined) parts.push(<code key={m.index} className="bg-white/[0.07] rounded px-1 font-mono text-[11px] text-honey/90">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span key={key}>{parts}</span>;
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  function flushList() {
    if (listItems.length) {
      out.push(<ul key={`ul-${out.length}`} className="my-1 space-y-0.5 list-none pl-2">{listItems}</ul>);
      listItems = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bullet = line.match(/^[\-\*]\s+(.+)/);
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (bullet) {
      flushList();
      listItems.push(
        <li key={i} className="flex gap-1.5 text-ink-secondary text-[12px]">
          <span className="mt-[6px] w-1 h-1 rounded-full bg-ink-tertiary/60 shrink-0" />
          <span>{renderInline(bullet[1])}</span>
        </li>
      );
    } else if (heading) {
      flushList();
      out.push(<p key={i} className="text-[13px] font-semibold text-ink-primary mt-2 mb-0.5">{renderInline(heading[2])}</p>);
    } else if (line === "") {
      flushList();
      if (i > 0 && i < lines.length - 1) out.push(<div key={i} className="h-1.5" />);
    } else {
      flushList();
      out.push(<p key={i} className="text-ink-secondary text-[12px] leading-relaxed">{renderInline(line)}</p>);
    }
  }
  flushList();
  return <div className="space-y-0.5">{out}</div>;
}

// ── Message bubble ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-ink-ghost hover:text-ink-secondary"
    >
      {copied ? <Check className="w-2.5 h-2.5 text-semantic-income" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex animate-slide-up group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-6 h-6 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <Sparkles className="w-3 h-3 text-honey" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[82%]">
        <div className={cn(
          "rounded-2xl px-3 py-2 text-[12px]",
          isUser
            ? "bg-honey/[0.12] border border-honey/20 text-ink-primary rounded-br-sm leading-relaxed whitespace-pre-wrap"
            : "bg-[#111216] border border-white/[0.06] rounded-bl-sm"
        )}>
          {isUser ? msg.content : <MarkdownText content={msg.content} />}
        </div>
        {!isUser && (
          <div className="flex items-center gap-1 pl-1">
            {msg.model_used && (
              <p className="text-[9px] text-ink-tertiary/40">
                {msg.model_used.startsWith("ollama/") ? `local · ${msg.model_used.replace("ollama/", "")}` : "claude · sonnet"}
              </p>
            )}
            <CopyButton text={msg.content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useClaude, setUseClaude] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
        return updated.length > 40 ? updated.slice(-40) : updated;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      setError(msg.includes("503") && !useClaude ? "Local AI unavailable — try Claude" : msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) { e.preventDefault(); sendMessage(input); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 flex flex-col"
          style={{
            width: 380,
            height: 520,
            background: "#0D0F15",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            animation: "fadeUp 0.15s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05] shrink-0">
            <div className="w-7 h-7 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-honey" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink-primary">AI Financial Advisor</p>
              <p className="text-[10px] text-ink-tertiary">{useClaude ? "Claude Sonnet" : "Local model"} · Enter to send</p>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Model toggle */}
              <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setUseClaude(false)}
                  className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors", !useClaude ? "bg-honey/[0.15] text-honey" : "text-ink-ghost hover:text-ink-tertiary")}
                >
                  Local
                </button>
                <button
                  type="button"
                  onClick={() => setUseClaude(true)}
                  className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors", useClaude ? "bg-honey/[0.15] text-honey" : "text-ink-ghost hover:text-ink-tertiary")}
                >
                  Claude
                </button>
              </div>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="text-[10px] text-ink-ghost hover:text-ink-tertiary transition-colors px-1">
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-1.5 mt-1">
                <p className="text-[9px] font-semibold text-ink-ghost uppercase tracking-wider px-1 mb-2">Try asking…</p>
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[12px] text-ink-secondary hover:border-honey/20 hover:text-ink-primary hover:bg-honey/[0.03] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="w-6 h-6 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <Sparkles className="w-3 h-3 text-honey" />
                </div>
                <div className="bg-[#111216] border border-white/[0.06] rounded-2xl rounded-bl-sm px-3 py-2">
                  <TypingDots />
                </div>
              </div>
            )}
            {error && (
              <div className="text-center text-[12px] text-semantic-expense bg-semantic-expense/[0.08] border border-semantic-expense/20 rounded-xl px-3 py-2">
                {error}
                {error.includes("Local AI unavailable") && (
                  <button onClick={() => { setUseClaude(true); setError(null); }} className="block mx-auto mt-1 text-[11px] text-honey underline">
                    Switch to Claude
                  </button>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances…"
                rows={1}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/40 transition-colors resize-none"
                style={{ maxHeight: 100 }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl bg-honey flex items-center justify-center shrink-0 hover:opacity-85 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4 text-black" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
          "shadow-lg shadow-black/40",
          open
            ? "bg-honey/[0.15] border border-honey/30 text-honey"
            : "bg-[#0D0F15] border border-white/[0.10] text-ink-secondary hover:border-honey/30 hover:text-honey"
        )}
        title="AI Financial Advisor"
        aria-label="Open AI chat"
      >
        <Sparkles className="w-5 h-5" />
      </button>
    </>
  );
}
