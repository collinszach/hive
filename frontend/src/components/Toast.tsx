"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

// Module-level pub/sub state — no React Context needed
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let toasts: ToastItem[] = [];

function notify(): void {
  listeners.forEach((l) => l([...toasts]));
}

function removeToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function addToast(type: ToastType, message: string): void {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, type, message }];
  if (toasts.length > 4) toasts = toasts.slice(-4);
  notify();
  setTimeout(() => removeToast(id), 4000);
}

export const toast = {
  success: (message: string) => addToast("success", message),
  error: (message: string) => addToast("error", message),
  info: (message: string) => addToast("info", message),
  warning: (message: string) => addToast("warning", message),
};

const TYPE_CONFIG: Record<
  ToastType,
  { color: string; Icon: React.ComponentType<{ size?: number | string; color?: string }> }
> = {
  success: { color: "#34D399", Icon: CheckCircle2 },
  error:   { color: "#F87171", Icon: XCircle },
  info:    { color: "#38BDF8", Icon: Info },
  warning: { color: "#F5B942", Icon: AlertTriangle },
};

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const { color, Icon } = TYPE_CONFIG[item.type];

  return (
    <div
      style={{
        width: "320px",
        background: "#0F1117",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `4px solid ${color}`,
        borderRadius: "12px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "14px 14px 14px 16px",
        animation: "toast-slide-in 0.22s ease-out forwards",
      }}
    >
      <Icon size={18} color={color} />
      <span
        style={{
          flex: 1,
          fontSize: "14px",
          lineHeight: "1.45",
          color: "#F0F0F4",
          wordBreak: "break-word",
        }}
      >
        {item.message}
      </span>
      <button
        onClick={() => onDismiss(item.id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px",
          color: "#4B5063",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "#4B5063")
        }
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        {items.map((item) => (
          <div key={item.id} style={{ pointerEvents: "auto" }}>
            <ToastCard item={item} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </>
  );
}
