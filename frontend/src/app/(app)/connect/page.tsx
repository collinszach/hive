"use client";

import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from "react-plaid-link";
import Link from "next/link";
import {
  Link2, CheckCircle, AlertCircle, Building2, Trash2,
  ChevronDown, ChevronUp, Info, RefreshCw, Copy, Check,
  ExternalLink, Shield, Zap, PenLine, Plus, X, TrendingUp, Receipt,
} from "lucide-react";
import { api, LinkedInstitution } from "@/lib/api";
import { AccountGraph } from "@/components/AccountGraph";
import { authedFetch } from "@/lib/auth";
import { toast } from "@/components/Toast";

interface ManualAccount {
  id: string;
  name: string;
  institution: string;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  currency: string;
  is_manual: boolean;
}

const ACCOUNT_TYPES = [
  { value: "depository",  label: "Bank / Checking / Savings" },
  { value: "investment",  label: "Investment / Brokerage" },
  { value: "credit",      label: "Credit Card" },
  { value: "loan",        label: "Loan / Mortgage" },
  { value: "other",       label: "Other" },
];

const OAUTH_BANKS = [
  "Capital One", "Chase", "Wells Fargo", "American Express",
  "Bank of America", "Citi", "US Bank",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="flex items-center gap-1 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors ml-1"
    >
      {copied ? <Check className="w-3 h-3 text-semantic-income" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function ConnectPage() {
  const [linkToken, setLinkToken]                     = useState<string | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>(undefined);
  const [status, setStatus]                           = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [message, setMessage]                         = useState<string>("");
  const [linked, setLinked]                           = useState<LinkedInstitution[]>([]);
  const [expandedItems, setExpandedItems]             = useState<Set<string>>(new Set());
  const [unlinking, setUnlinking]                     = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink]             = useState<string | null>(null);
  const [syncing, setSyncing]                         = useState(false);
  const [showOAuthSetup, setShowOAuthSetup]           = useState(false);
  const [manualAccounts, setManualAccounts]           = useState<ManualAccount[]>([]);
  const [showAddManual, setShowAddManual]             = useState(false);
  const [editingManual, setEditingManual]             = useState<ManualAccount | null>(null);
  const [manualForm, setManualForm]                   = useState({
    name: "", institution: "", type: "depository", subtype: "", current_balance: "", currency: "USD",
  });
  const [manualLoading, setManualLoading]             = useState(false);
  const [snaptradeLoading, setSnaptradeLoading]       = useState(false);
  const [snaptradeMessage, setSnaptradeMessage]       = useState<string>("");
  const [investLinkToken, setInvestLinkToken]         = useState<string | null>(null);
  const [investLinkLoading, setInvestLinkLoading]     = useState(false);
  const [showGraph, setShowGraph]                     = useState(false);
  const [plaidGated, setPlaidGated]                   = useState(false);

  const detectedRedirectUri = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/connect`
    : "";

  const fetchLinkToken = useCallback(() => {
    authedFetch(`/api/plaid/link-token`, { method: "POST" })
      .then(async (r) => {
        if (r.status === 402) {
          setPlaidGated(true);
          return null;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail ?? `Server error ${r.status}`);
        if (!data.link_token) throw new Error("Server returned no link_token");
        return data;
      })
      .then((data) => { if (data) setLinkToken(data.link_token); })
      .catch((err) => {
        setStatus("error");
        setMessage(`Failed to get link token: ${err.message}`);
      });
  }, []);

  const fetchLinked = useCallback(() => {
    api.accounts.linked().then(setLinked).catch(() => toast.error("Failed to load linked accounts"));
  }, []);

  const isOAuthReturn = typeof window !== "undefined" && window.location.href.includes("oauth_state_id=");

  const fetchManualAccounts = useCallback(() => {
    authedFetch("/api/accounts")
      .then((r) => r.ok ? r.json() : [])
      .then((accounts: ManualAccount[]) => setManualAccounts(accounts.filter((a) => a.is_manual)))
      .catch(() => toast.error("Failed to load manual accounts"));
  }, []);

  useEffect(() => {
    fetchLinked();
    fetchManualAccounts();
    if (isOAuthReturn) setReceivedRedirectUri(window.location.href);
    fetchLinkToken();
  }, [fetchLinkToken, fetchLinked, fetchManualAccounts, isOAuthReturn]);

  function openAddManual() {
    setEditingManual(null);
    setManualForm({ name: "", institution: "", type: "depository", subtype: "", current_balance: "", currency: "USD" });
    setShowAddManual(true);
  }

  function openEditManual(acct: ManualAccount) {
    setEditingManual(acct);
    setManualForm({
      name: acct.name,
      institution: acct.institution,
      type: acct.type,
      subtype: acct.subtype ?? "",
      current_balance: acct.current_balance != null ? String(acct.current_balance) : "",
      currency: acct.currency,
    });
    setShowAddManual(true);
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setManualLoading(true);
    const payload = {
      name: manualForm.name,
      institution: manualForm.institution,
      type: manualForm.type,
      subtype: manualForm.subtype || null,
      current_balance: parseFloat(manualForm.current_balance) || 0,
      currency: manualForm.currency,
    };
    try {
      if (editingManual) {
        const res = await authedFetch(`/api/accounts/manual/${editingManual.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Update failed");
        toast.success("Account updated");
      } else {
        const res = await authedFetch("/api/accounts/manual", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Create failed");
        toast.success("Account added");
      }
      setShowAddManual(false);
      fetchManualAccounts();
    } catch {
      toast.error(editingManual ? "Failed to update account" : "Failed to add account");
    } finally {
      setManualLoading(false);
    }
  }

  async function handleDeleteManual(id: string) {
    try {
      await authedFetch(`/api/accounts/manual/${id}`, { method: "DELETE" });
      setManualAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Account removed");
    } catch {
      toast.error("Failed to remove account");
    }
  }

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setStatus("syncing");
      try {
        const res = await authedFetch(`/api/plaid/exchange-token`, {
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
        setReceivedRedirectUri(undefined);
        setStatus("success");
        setMessage(`Connected ${metadata.institution?.name ?? "your bank"} — ${data.accounts_created} account(s) linked. Syncing now…`);
        fetchLinked();
        if (window.location.search.includes("oauth_state_id")) {
          window.history.replaceState({}, "", "/connect");
        }
        setTimeout(() => { setStatus("idle"); setMessage(""); fetchLinkToken(); }, 5000);
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [fetchLinked, fetchLinkToken]
  );

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess,
    ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
  };
  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready && receivedRedirectUri) open();
  }, [ready, receivedRedirectUri, open]);

  const onInvestSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
    setInvestLinkLoading(true);
    setInvestLinkToken(null);
    try {
      await authedFetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token,
          institution_id: metadata.institution?.institution_id ?? null,
          institution_name: metadata.institution?.name ?? null,
        }),
      });
      toast.success("Investment account connected!");
      fetchLinked();
    } catch {
      toast.error("Failed to link investment account");
    } finally {
      setInvestLinkLoading(false);
    }
  }, [fetchLinked]);

  const investConfig: PlaidLinkOptions = useMemo(() => ({
    token: investLinkToken,
    onSuccess: onInvestSuccess,
    onExit: () => { setInvestLinkToken(null); setInvestLinkLoading(false); },
  }), [investLinkToken, onInvestSuccess]);

  const { open: openInvestments, ready: investmentsReady } = usePlaidLink(investConfig);

  useEffect(() => {
    if (investLinkToken && investmentsReady) openInvestments();
  }, [investLinkToken, investmentsReady, openInvestments]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    // SnapTrade redirects back with ?connectionId=... or we add ?snaptrade_connected=1
    const isSnaptradeReturn = params.get("snaptrade_connected") === "1" || params.has("connectionId");
    if (!isSnaptradeReturn) return;
    window.history.replaceState({}, "", "/connect");
    api.snaptrade.callback()
      .then((data) => {
        setSnaptradeMessage(`Connected ${data.accounts_added} investment account(s). Balances will sync shortly.`);
        fetchLinked();
      })
      .catch(() => {
        setSnaptradeMessage("SnapTrade connection completed but failed to fetch accounts. Try refreshing.");
      });
  }, [fetchLinked]);

  const handleUnlink = async (item_id: string) => {
    setUnlinking(item_id);
    setConfirmUnlink(null);
    try {
      const result = await api.accounts.unlink(item_id, true);
      setLinked((prev) => prev.filter((l) => l.item_id !== item_id));
      setMessage(`Unlinked — ${result.accounts_removed} account(s) and ${result.transactions_deleted} transaction(s) removed.`);
    } catch {
      setStatus("error");
      setMessage("Failed to unlink. Try again.");
    } finally {
      setUnlinking(null);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await authedFetch("/api/plaid/sync-now", { method: "POST" });
      setStatus("success");
      setMessage("Sync queued — transactions will update in ~30 seconds.");
      setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
    } catch {
      setStatus("error");
      setMessage("Failed to trigger sync.");
    } finally {
      setSyncing(false);
    }
  };

  async function handleSnaptradeConnect() {
    setSnaptradeLoading(true);
    setSnaptradeMessage("");
    try {
      const data = await api.snaptrade.connect();
      window.location.href = data.redirect_url;
    } catch {
      setSnaptradeMessage("Failed to connect to SnapTrade. Check server configuration.");
      setSnaptradeLoading(false);
    }
  }

  async function handleInvestmentsConnect() {
    setInvestLinkLoading(true);
    try {
      const data = await api.plaid.investmentsLinkToken();
      setInvestLinkToken(data.link_token);
    } catch {
      toast.error("Failed to start brokerage connection");
      setInvestLinkLoading(false);
    }
  }

  const toggleExpand = (item_id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(item_id) ? next.delete(item_id) : next.add(item_id);
      return next;
    });
  };

  const formatBalance = (acct: LinkedInstitution["accounts"][0]) => {
    const val = acct.type === "credit"
      ? acct.current_balance
      : (acct.available_balance ?? acct.current_balance);
    if (val == null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Connected Accounts</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">
            Hive uses Plaid to securely pull transactions. Your credentials are never stored.
          </p>
        </div>
        {linked.length > 0 && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="hive-btn-secondary py-1.5 text-[13px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        )}
      </div>

      {/* ── Status Banners ──────────────────────────────────────────── */}
      {isOAuthReturn && !status.startsWith("success") && (
        <div className="flex items-center gap-3 rounded-xl bg-honey/[0.08] border border-honey/20 p-4">
          <div className="w-4 h-4 rounded-full border border-honey border-t-transparent animate-spin shrink-0" />
          <p className="text-[13px] text-honey">Completing OAuth connection — opening Plaid…</p>
        </div>
      )}
      {status === "syncing" && (
        <div className="flex items-center gap-3 rounded-xl bg-honey/[0.06] border border-honey/20 p-4">
          <div className="w-4 h-4 rounded-full border border-honey border-t-transparent animate-spin shrink-0" />
          <p className="text-[13px] text-ink-secondary">Connecting account…</p>
        </div>
      )}
      {status === "success" && (
        <div className="flex items-start gap-3 rounded-xl bg-semantic-income/[0.08] border border-semantic-income/20 p-4">
          <CheckCircle className="w-4 h-4 text-semantic-income shrink-0 mt-0.5" />
          <p className="text-[13px] text-semantic-income">{message}</p>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-start gap-3 rounded-xl bg-semantic-expense/[0.08] border border-semantic-expense/20 p-4">
          <AlertCircle className="w-4 h-4 text-semantic-expense shrink-0 mt-0.5" />
          <p className="text-[13px] text-semantic-expense">{message}</p>
        </div>
      )}
      {status === "idle" && message && (
        <div className="flex items-start gap-3 rounded-xl hive-card p-4">
          <CheckCircle className="w-4 h-4 text-ink-tertiary shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-secondary">{message}</p>
        </div>
      )}

      {/* ── Linked Institutions ─────────────────────────────────────── */}
      {linked.length > 0 && (
        <div className="space-y-2">
          <p className="hive-label">
            {linked.length} Linked Institution{linked.length !== 1 ? "s" : ""}
          </p>
          {linked.map((inst) => {
            const expanded = expandedItems.has(inst.item_id);
            const isUnlinking = unlinking === inst.item_id;
            const isConfirming = confirmUnlink === inst.item_id;
            const totalBalance = inst.accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);

            return (
              <div key={inst.item_id} className="hive-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-[10px] bg-elevated border border-white/[0.06] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-ink-tertiary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-ink-primary truncate">
                        {inst.institution_name}
                      </p>
                      {inst.last_sync_error && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-semantic-expense/10 text-semantic-expense border border-semantic-expense/20">
                          Needs reauth
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-tertiary font-mono">
                      {inst.accounts.length} account{inst.accounts.length !== 1 ? "s" : ""}
                      <span className="mx-1.5 opacity-40">·</span>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalBalance)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isConfirming ? (
                      <>
                        <span className="text-[12px] text-semantic-expense mr-1">Remove all data?</span>
                        <button
                          onClick={() => handleUnlink(inst.item_id)}
                          disabled={isUnlinking}
                          className="hive-btn-danger py-1 px-2.5 text-[12px]"
                        >
                          {isUnlinking ? "Removing…" : "Yes"}
                        </button>
                        <button
                          onClick={() => setConfirmUnlink(null)}
                          className="hive-btn-secondary py-1 px-2.5 text-[12px]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmUnlink(inst.item_id)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-tertiary/50
                                   hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(inst.item_id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-tertiary
                                 hover:bg-white/[0.05] transition-colors"
                    >
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-white/[0.04]">
                    {inst.accounts.map((acct, i) => (
                      <div
                        key={acct.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${
                          i < inst.accounts.length - 1 ? "border-b border-white/[0.04]" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0 pl-12">
                          <p className="text-[13px] text-ink-secondary truncate">
                            {acct.name}
                            {acct.mask && (
                              <span className="text-ink-tertiary ml-1.5 font-mono text-[11px]">
                                ••{acct.mask}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-ink-tertiary/60 capitalize">
                            {acct.type}{acct.subtype ? ` · ${acct.subtype}` : ""}
                          </p>
                        </div>
                        <p className="text-[13px] text-ink-secondary font-mono tabular-nums">
                          {formatBalance(acct)}
                        </p>
                        {acct.type !== "investment" && (
                          <Link
                            href={`/transactions?account_id=${acct.id}`}
                            className="flex items-center gap-1 text-[11px] text-ink-tertiary/60 hover:text-honey transition-colors shrink-0"
                            title="View transactions"
                          >
                            <Receipt className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {linked.length === 0 && (
        <div className="hive-card p-12 text-center border-dashed">
          <Building2 className="w-8 h-8 text-ink-tertiary/30 mx-auto mb-2" />
          <p className="text-[14px] text-ink-secondary mb-1">No accounts linked yet</p>
          <p className="text-[12px] text-ink-tertiary">Connect your first bank or credit card below.</p>
        </div>
      )}

      {/* ── Add Institution ─────────────────────────────────────────── */}
      <div className="hive-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-honey" />
          <h2 className="text-[14px] font-semibold text-ink-primary">Add Institution</h2>
        </div>
        <p className="text-[12px] text-ink-tertiary mb-4">
          Connect any bank, credit card, or investment account. Plaid supports 12,000+ institutions.
        </p>
        {plaidGated ? (
          <div className="hive-card p-5 text-center mb-4">
            <p className="text-ink-primary font-semibold mb-2">Bank Sync Requires Starter or Pro</p>
            <p className="text-ink-secondary text-sm mb-4">
              Connect up to 3 accounts on Starter ($9/mo) or 10 on Pro ($19/mo).
            </p>
            <a href="/billing" className="hive-btn-primary inline-block">View Plans →</a>
          </div>
        ) : (
          <button
            onClick={() => open()}
            disabled={!ready || status === "syncing"}
            className="hive-btn-primary"
          >
            <Link2 className="w-4 h-4" />
            {!linkToken ? "Loading…" : status === "syncing" ? "Connecting…" : "Connect Bank Account"}
          </button>
        )}
      </div>

      {/* ── Investment Accounts ────────────────────────────────────── */}
      <div className="hive-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-honey" />
          <h2 className="text-[14px] font-semibold text-ink-primary">Investment Accounts</h2>
        </div>
        <p className="text-[12px] text-ink-tertiary mb-4">
          Connect brokerages and IRAs to track balances and holdings.
        </p>
        {plaidGated ? (
          <div className="hive-card p-5 text-center">
            <p className="text-ink-primary font-semibold mb-2">Requires Starter or Pro Plan</p>
            <a href="/billing" className="hive-btn-primary inline-block">View Plans →</a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="min-w-0">
                <p className="text-[13px] text-ink-primary font-medium">Schwab, Robinhood, Wealthfront…</p>
                <p className="text-[11px] text-ink-tertiary">via SnapTrade OAuth</p>
              </div>
              <button
                onClick={handleSnaptradeConnect}
                disabled={snaptradeLoading}
                className="hive-btn-secondary text-sm shrink-0"
              >
                {snaptradeLoading ? "Loading…" : "Connect →"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="min-w-0">
                <p className="text-[13px] text-ink-primary font-medium">Vanguard, Fidelity, and 8,000+ more</p>
                <p className="text-[11px] text-ink-tertiary">via Plaid Investments</p>
              </div>
              <button
                onClick={handleInvestmentsConnect}
                disabled={investLinkLoading}
                className="hive-btn-secondary text-sm shrink-0"
              >
                {investLinkLoading ? "Loading…" : "Connect →"}
              </button>
            </div>
          </div>
        )}
        {snaptradeMessage && (
          <p className="text-[12px] text-semantic-income mt-3">{snaptradeMessage}</p>
        )}
      </div>

      {/* ── Manual Accounts ─────────────────────────────────────────── */}
      <div className="hive-card overflow-hidden">
        <div className="hive-section-header">
          <div className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-honey/70" />
            <h2 className="text-[14px] font-semibold text-ink-primary">Manual Accounts</h2>
            {manualAccounts.length > 0 && (
              <span className="text-[12px] text-ink-tertiary">{manualAccounts.length}</span>
            )}
          </div>
          <button
            onClick={openAddManual}
            className="hive-btn-secondary py-1 px-2.5 text-[12px]"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {manualAccounts.length === 0 && !showAddManual && (
          <div className="px-5 py-4 text-[13px] text-ink-tertiary">
            Track cash, a non-managed brokerage, or any account not on Plaid.
          </div>
        )}

        {manualAccounts.length > 0 && (
          <div className="divide-y divide-white/[0.04]">
            {manualAccounts.map((acct) => (
              <div key={acct.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <Building2 className="w-4 h-4 text-ink-tertiary/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink-primary truncate">{acct.name}</p>
                  <p className="text-[11px] text-ink-tertiary/60 capitalize">
                    {acct.institution}{acct.subtype ? ` · ${acct.subtype}` : ""}
                  </p>
                </div>
                <p className="text-[13px] font-mono text-ink-secondary tabular-nums shrink-0">
                  {acct.current_balance != null
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: acct.currency }).format(acct.current_balance)
                    : "—"}
                </p>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => openEditManual(acct)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-tertiary/50
                               hover:text-ink-secondary hover:bg-white/[0.05] transition-colors"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteManual(acct.id)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-tertiary/50
                               hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddManual && (
          <form onSubmit={handleManualSubmit} className="border-t border-white/[0.04] px-5 py-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="hive-label">{editingManual ? "Edit account" : "New manual account"}</p>
              <button type="button" onClick={() => setShowAddManual(false)} className="text-ink-tertiary hover:text-ink-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Account name", field: "name", placeholder: "Fidelity Brokerage", type: "text" },
                { label: "Institution", field: "institution", placeholder: "Fidelity", type: "text" },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label className="block text-[11px] text-ink-tertiary mb-1.5">{label}</label>
                  <input
                    type={type}
                    required
                    value={(manualForm as Record<string, string>)[field]}
                    onChange={(e) => setManualForm((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="hive-input text-[13px]"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] text-ink-tertiary mb-1.5">Type</label>
                <select
                  value={manualForm.type}
                  onChange={(e) => setManualForm((f) => ({ ...f, type: e.target.value }))}
                  className="hive-select w-full text-[13px]"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-ink-tertiary mb-1.5">Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary text-[13px] pointer-events-none">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualForm.current_balance}
                    onChange={(e) => setManualForm((f) => ({ ...f, current_balance: e.target.value }))}
                    placeholder="0.00"
                    className="hive-input text-[13px] font-mono"
                    style={{ paddingLeft: "1.75rem" }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAddManual(false)} className="hive-btn-ghost text-[13px] py-1.5 px-3">
                Cancel
              </button>
              <button type="submit" disabled={manualLoading} className="hive-btn-primary py-1.5 text-[13px]">
                {manualLoading ? "Saving…" : editingManual ? "Save changes" : "Add account"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Finance Map ─────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => setShowGraph((v) => !v)}
          className="flex items-center gap-2 w-full px-5 py-3.5 border-t border-white/[0.05] hover:bg-white/[0.02] transition-colors text-left"
        >
          <TrendingUp className="w-4 h-4 text-ink-ghost" />
          <span className="text-[13px] font-medium text-ink-secondary">Finance Map</span>
          <span className="text-[11px] text-ink-tertiary ml-1">— visualize money flow across your accounts</span>
          <span className="ml-auto">
            {showGraph
              ? <ChevronUp className="w-4 h-4 text-ink-ghost" />
              : <ChevronDown className="w-4 h-4 text-ink-ghost" />}
          </span>
        </button>
        {showGraph && (
          <div className="px-5 pb-5">
            <AccountGraph />
          </div>
        )}
      </div>

    </div>
  );
}
