"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from "react-plaid-link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function ConnectPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  // Fetch link token on mount
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

  // Log ready state changes for debugging
  useEffect(() => {
    console.log("[Plaid] ready:", ready, "linkToken set:", !!linkToken);
  }, [ready, linkToken]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="max-w-md w-full mx-4 p-8 bg-gray-900 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Connect a Bank Account</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Hive uses Plaid to securely link your accounts. Your credentials are
          never stored — only a read-only access token.
        </p>

        {status === "idle" || status === "loading" ? (
          <button
            onClick={() => open()}
            disabled={!ready || status === "loading"}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700
                       disabled:text-gray-500 rounded-xl font-semibold transition-colors"
          >
            {!linkToken
              ? "Loading…"
              : status === "loading"
              ? "Connecting…"
              : "Connect Bank Account"}
          </button>
        ) : null}

        {status === "success" && (
          <div className="rounded-xl bg-green-900/40 border border-green-700 p-4 text-green-300 text-sm">
            {message}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl bg-red-900/40 border border-red-700 p-4 text-red-300 text-sm">
            {message}
          </div>
        )}

        {status === "success" && (
          <a
            href="/"
            className="mt-4 block text-center text-sm text-indigo-400 hover:text-indigo-300"
          >
            Go to Dashboard →
          </a>
        )}
      </div>
    </main>
  );
}
