"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from "react-plaid-link";
import { Link2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function ConnectPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    console.log("[Plaid] Fetching link token from", `${API_BASE}/api/plaid/link-token`);
    fetch(`/api/plaid/link-token`, { method: "POST" })
      .then(async (r) => {
        console.log("[Plaid] link-token response status:", r.status);
        const data = await r.json();
        console.log("[Plaid] link-token response body:", data);
        if (!r.ok) {
          throw new Error(data.detail ?? `Server error ${r.status}`);
        }
        if (!data.link_token) {
          throw new Error("Server returned no link_token");
        }
        return data;
      })
      .then((data) => {
        console.log("[Plaid] link token received, length:", data.link_token.length);
        setLinkToken(data.link_token);
      })
      .catch((err) => {
        console.error("[Plaid] link token error:", err);
        setStatus("error");
        setMessage(`Failed to get link token: ${err.message}`);
      });
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/plaid/exchange-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_id: metadata.institution?.institution_id ?? null,
            institution_name: metadata.institution?.name ?? null,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail ?? "Exchange failed");
        }

        const data = await res.json();
        setStatus("success");
        setMessage(
          `Connected! ${data.accounts_created} account(s) linked for ${
            metadata.institution?.name ?? "your bank"
          }. Syncing transactions now — redirecting to dashboard in a few seconds.`
        );
        setTimeout(() => router.push("/"), 4000);
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unknown error");
      }
    },
    []
  );

  const config: PlaidLinkOptions = {
    token: linkToken ?? "",
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    console.log("[Plaid] ready:", ready, "linkToken set:", !!linkToken);
  }, [ready, linkToken]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      <div className="max-w-md">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Connect a Bank Account</h1>
        </div>
        <p className="text-sm text-slate-500 ml-10.5">
          Hive uses Plaid to securely link your accounts. Your credentials are never stored — only a read-only access token.
        </p>
      </div>

      <div className="max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        {(status === "idle" || status === "loading") && (
          <button
            onClick={() => open()}
            disabled={!ready || status === "loading"}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800
                       disabled:text-slate-500 rounded-xl font-semibold text-sm transition-colors"
          >
            {!linkToken
              ? "Loading…"
              : status === "loading"
              ? "Connecting…"
              : "Connect Bank Account"}
          </button>
        )}

        {status === "success" && (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-300 leading-relaxed">{message}</p>
              <Link href="/" className="mt-2 block text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Go to Dashboard →
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-300">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
