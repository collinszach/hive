"use client";

import { useState, useEffect, useRef } from "react";
import { cn, fmt, fmtDate, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { api, Transaction, Tag, Contact, ExpenseShare } from "@/lib/api";
import { Plus, Check, ChevronRight, Users, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/Toast";

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Drink":   "🍽️",
  "Groceries":      "🛒",
  "Travel":         "✈️",
  "Transportation": "🚗",
  "Entertainment":  "🎬",
  "Shopping":       "🛍️",
  "Health":         "🏥",
  "Utilities":      "💡",
  "Home":           "🏠",
  "Education":      "📚",
  "Personal Care":  "💆",
  "Transfers":      "🔄",
  "Business":       "💼",
  "Uncategorized":  "📋",
};

interface TransactionDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  onCategoryChange?: (id: string, category: string, subcategory: string | null) => void;
  onSelectTransaction?: (tx: Transaction) => void;
}


export function TransactionDrawer({ transaction, onClose, onCategoryChange, onSelectTransaction }: TransactionDrawerProps) {
  const [category, setCategory] = useState<string>("");
  const [subcategory, setSubcategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesCommittedRef = useRef<string>("");
  const [rememberSaving, setRememberSaving] = useState(false);
  const [rememberDone, setRememberDone] = useState(false);
  const [similarTxns, setSimilarTxns] = useState<Transaction[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [txTags, setTxTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);
  // Expense shares
  const [shares, setShares] = useState<ExpenseShare[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [addingShare, setAddingShare] = useState(false);
  const [newShareContactId, setNewShareContactId] = useState("");
  const [newShareAmount, setNewShareAmount] = useState("");
  const [newShareNote, setNewShareNote] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [transaction, onClose]);

  useEffect(() => {
    if (transaction) {
      setCategory(transaction.category ?? "Uncategorized");
      setSubcategory(transaction.subcategory ?? "");
      setNotes(transaction.notes ?? "");
      notesCommittedRef.current = transaction.notes ?? "";
      setNotesSaved(false);
      setRememberDone(false);
      setTagInput("");
      setShares([]);
      setSharesOpen(false);
      setAddingShare(false);
      setNewShareContactId("");
      setNewShareAmount("");
      setNewShareNote("");
      setAddingContact(false);
      // Load tags + shares in parallel
      setLoadingTags(true);
      Promise.all([
        api.tags.forTransaction(transaction.id),
        api.tags.list(),
        api.shares.list(transaction.id),
        api.contacts.list(),
      ])
        .then(([txT, all, txShares, allContacts]) => {
          setTxTags(txT);
          setAllTags(all);
          setShares(txShares);
          setContacts(allContacts);
        })
        .catch(() => {})
        .finally(() => setLoadingTags(false));
    }
  }, [transaction]);

  useEffect(() => {
    if (!transaction?.merchant) {
      setSimilarTxns([]);
      return;
    }
    setLoadingSimilar(true);
    api.transactions
      .list({ search: transaction.merchant, page_size: 5 })
      .then((res) => {
        setSimilarTxns(res.items.filter((t) => t.id !== transaction.id).slice(0, 4));
      })
      .catch(() => setSimilarTxns([]))
      .finally(() => setLoadingSimilar(false));
  }, [transaction?.merchant, transaction?.id]);

  async function handleSave() {
    if (!transaction) return;
    setSaving(true);
    try {
      await api.transactions.updateCategory(transaction.id, category, subcategory);
      onCategoryChange?.(transaction.id, category, subcategory || null);
      onClose();
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!transaction) return;
    setSavingNotes(true);
    try {
      await api.transactions.patch(transaction.id, { notes: notes.trim() || null });
      notesCommittedRef.current = notes.trim();
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNotes(false);
    }
  }

  function handleNotesBlur() {
    if (notes.trim() !== notesCommittedRef.current && !savingNotes) {
      handleSaveNotes();
    }
  }

  async function handleRemember() {
    if (!transaction) return;
    const merchant = transaction.merchant ?? transaction.raw_description;
    if (!merchant) return;
    setRememberSaving(true);
    try {
      await api.rules.create({
        match_type: "contains",
        match_value: merchant,
        category,
        subcategory: subcategory || null,
        priority: 50,
        amount_min: null,
        amount_max: null,
      });
      setRememberDone(true);
      toast.success("Rule saved — will apply to future transactions");
      api.plaid.applyRules().catch(() => {});
    } catch {
      toast.error("Failed to save rule");
    } finally {
      setRememberSaving(false);
    }
  }

  async function applyTag(tag: Tag) {
    if (!transaction) return;
    if (txTags.some((t) => t.id === tag.id)) return;
    try {
      await api.tags.add(transaction.id, tag.id);
      setTxTags((prev) => [...prev, tag]);
    } catch {
      toast.error("Failed to add tag");
    }
  }

  async function removeTag(tagId: string) {
    if (!transaction) return;
    try {
      await api.tags.remove(transaction.id, tagId);
      setTxTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      toast.error("Failed to remove tag");
    }
  }

  async function createAndApplyTag() {
    if (!transaction || !tagInput.trim()) return;
    const name = tagInput.trim().toLowerCase();
    setTagInput("");
    try {
      const tag = await api.tags.create(name);
      setAllTags((prev) => prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]);
      await applyTag(tag);
    } catch {
      toast.error("Failed to create tag");
    }
  }

  const suggestions = allTags.filter(
    (t) => !txTags.some((tx) => tx.id === t.id) && t.name.includes(tagInput.toLowerCase())
  );

  async function handleAddShare() {
    if (!transaction || !newShareContactId || !newShareAmount) return;
    setSavingShare(true);
    try {
      const share = await api.shares.create(transaction.id, {
        contact_id: newShareContactId,
        amount: parseFloat(newShareAmount),
        note: newShareNote || undefined,
      });
      setShares((prev) => [...prev, share]);
      setNewShareContactId("");
      setNewShareAmount("");
      setNewShareNote("");
      setAddingShare(false);
      toast.success("Expense shared");
    } catch {
      toast.error("Failed to share expense");
    } finally {
      setSavingShare(false);
    }
  }

  async function handleSettleShare(shareId: string) {
    try {
      await api.shares.settle(shareId);
      setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, status: "settled" as const } : s));
      toast.success("Marked as settled");
    } catch {
      toast.error("Failed to settle");
    }
  }

  async function handleDeleteShare(shareId: string) {
    try {
      await api.shares.delete(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success("Share removed");
    } catch {
      toast.error("Failed to remove share");
    }
  }

  async function handleAddContact() {
    if (!newContactName.trim()) return;
    try {
      const contact = await api.contacts.create(newContactName.trim());
      setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
      setNewShareContactId(contact.id);
      setNewContactName("");
      setAddingContact(false);
      toast.success(`Added ${contact.name}`);
    } catch {
      toast.error("Failed to add contact");
    }
  }

  const isOpen = transaction !== null;
  const isIncome = (transaction?.amount ?? 0) < 0;
  const emoji = CATEGORY_EMOJI[transaction?.category ?? ""] ?? "📋";
  const subcategoryOptions = SUBCATEGORIES[category] ?? [];
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-80 bg-[#0F1117] border-l border-white/[0.06]",
          "flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-ink-primary">Transaction Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.10] transition-colors text-ink-secondary text-[18px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {transaction && (
          <div className="flex-1 overflow-y-auto">
            {/* Hero section */}
            <div className="px-5 py-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center text-2xl">
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-ink-primary truncate">
                    {transaction.merchant ?? transaction.raw_description}
                  </p>
                  <p className="text-[12px] text-ink-tertiary mt-0.5">
                    {fmtDate(transaction.date)} · {transaction.account_name ?? "Unknown account"}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <p
                className={cn(
                  "text-3xl font-bold font-mono tabular-nums mt-1",
                  isIncome ? "text-emerald-400" : "text-ink-primary"
                )}
              >
                {isIncome ? "+" : ""}
                {fmt(Math.abs(transaction.amount))}
              </p>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {transaction.pending && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending
                  </span>
                )}
                {transaction.is_excluded && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    Excluded
                  </span>
                )}
                {transaction.payment_channel && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] text-ink-tertiary border border-white/[0.06] capitalize">
                    {transaction.payment_channel}
                  </span>
                )}
                {transaction.card_slug && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-honey/[0.08] text-honey border border-honey/[0.15]">
                    {transaction.card_slug.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>

            {/* Category editor */}
            <div className="px-5 py-5 border-b border-white/[0.06]">
              <p className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                Category
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] text-ink-secondary mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubcategory("");
                    }}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#161921]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {subcategoryOptions.length > 0 && (
                  <div>
                    <label className="block text-[12px] text-ink-secondary mb-1.5">Subcategory</label>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
                    >
                      <option value="" className="bg-[#161921]">
                        — none —
                      </option>
                      {subcategoryOptions.map((sub) => (
                        <option key={sub} value={sub} className="bg-[#161921]">
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150",
                      saving
                        ? "bg-honey/30 text-honey/50 cursor-not-allowed"
                        : "bg-honey/[0.12] border border-honey/25 text-honey hover:bg-honey/[0.18]"
                    )}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={handleRemember}
                    disabled={rememberSaving || rememberDone}
                    title={`Always categorize "${transaction.merchant ?? transaction.raw_description}" as ${category}${subcategory ? ` / ${subcategory}` : ""}`}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150 border",
                      rememberDone
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
                        : rememberSaving
                        ? "bg-white/[0.03] border-white/[0.06] text-ink-tertiary cursor-not-allowed"
                        : "bg-white/[0.04] border-white/[0.08] text-ink-secondary hover:bg-white/[0.08] hover:text-ink-primary"
                    )}
                  >
                    {rememberDone ? "✓ Saved" : "Remember"}
                  </button>
                </div>
              </div>
            </div>


            {/* Notes */}
            <div className="px-5 py-5 border-b border-white/[0.06]">
              <p className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                Notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add a note (split with roommate, reimbursable, etc.)"
                rows={3}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/40 transition-colors resize-none"
              />
              {(notesSaved || savingNotes || notes.trim() !== notesCommittedRef.current) && (
                <p className={cn(
                  "mt-1.5 text-[11px] text-right transition-all",
                  notesSaved ? "text-emerald-400" : savingNotes ? "text-ink-tertiary" : "text-ink-ghost"
                )}>
                  {notesSaved ? "✓ Saved" : savingNotes ? "Saving…" : "Unsaved — will save on blur"}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="px-5 py-5 border-b border-white/[0.06]">
              <p className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                Tags
              </p>

              {txTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {txTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-honey/[0.08] text-honey border border-honey/20"
                    >
                      {tag.name}
                      <button
                        onClick={() => removeTag(tag.id)}
                        className="hover:text-white transition-colors ml-0.5 leading-none"
                        aria-label="Remove tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      const exact = allTags.find((t) => t.name === tagInput.trim().toLowerCase());
                      if (exact) applyTag(exact);
                      else createAndApplyTag();
                    }
                  }}
                  placeholder="Add tag… (Enter to create)"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/40 transition-colors"
                />
                {tagInput && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#161921] border border-white/[0.10] rounded-lg overflow-hidden z-10 shadow-xl">
                    {suggestions.slice(0, 6).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => { applyTag(tag); setTagInput(""); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-ink-secondary hover:bg-white/[0.06] hover:text-ink-primary transition-colors"
                      >
                        {tag.name}
                      </button>
                    ))}
                    {!allTags.some((t) => t.name === tagInput.trim().toLowerCase()) && (
                      <button
                        onClick={createAndApplyTag}
                        className="w-full px-3 py-2 text-left text-[12px] text-honey/70 hover:bg-honey/[0.06] hover:text-honey transition-colors border-t border-white/[0.06]"
                      >
                        + Create &ldquo;{tagInput.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Share expense */}
            {transaction && (
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <button
                  onClick={() => setSharesOpen((o) => !o)}
                  className="flex items-center gap-2 w-full text-left mb-0"
                >
                  <Users className="w-3.5 h-3.5 text-ink-ghost" />
                  <span className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider">
                    Shared with
                  </span>
                  {shares.filter((s) => s.status === "pending").length > 0 && (
                    <span className="text-[9px] font-bold bg-honey/20 text-honey px-1.5 py-0.5 rounded ml-1">
                      {shares.filter((s) => s.status === "pending").length} pending
                    </span>
                  )}
                  <ChevronDown className={cn("w-3 h-3 text-ink-ghost ml-auto transition-transform", sharesOpen && "rotate-180")} />
                </button>

                {sharesOpen && (
                  <div className="space-y-2 mt-3">
                    {shares.map((share) => (
                      <div key={share.id} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg",
                        share.status === "settled" ? "bg-white/[0.02] opacity-60" : "bg-white/[0.04]"
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-ink-primary">{share.contact_name}</p>
                          {share.note && <p className="text-[10px] text-ink-ghost truncate">{share.note}</p>}
                        </div>
                        <p className="text-[12px] font-mono text-ink-primary tabular-nums shrink-0">{fmt(share.amount)}</p>
                        {share.status === "pending" ? (
                          <>
                            <button onClick={() => handleSettleShare(share.id)} className="shrink-0 text-ink-ghost hover:text-semantic-income border border-white/[0.08] hover:border-semantic-income/30 p-1 rounded transition-colors">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteShare(share.id)} className="shrink-0 text-ink-ghost hover:text-semantic-expense transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-ink-ghost shrink-0">Settled</span>
                        )}
                      </div>
                    ))}

                    {addingShare ? (
                      <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 space-y-2">
                        {!addingContact ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={newShareContactId}
                              onChange={(e) => setNewShareContactId(e.target.value)}
                              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-ink-primary flex-1 focus:outline-none focus:border-honey/40"
                            >
                              <option value="">— who owes you? —</option>
                              {contacts.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button onClick={() => setAddingContact(true)} className="text-[10px] text-ink-ghost hover:text-honey transition-colors shrink-0">
                              + New
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={newContactName}
                              onChange={(e) => setNewContactName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                              placeholder="Name (e.g. Anthony)"
                              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40"
                            />
                            <button onClick={handleAddContact} className="text-[10px] text-honey shrink-0">Save</button>
                            <button onClick={() => setAddingContact(false)} className="text-[10px] text-ink-ghost shrink-0">Cancel</button>
                          </div>
                        )}

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newShareAmount}
                          onChange={(e) => setNewShareAmount(e.target.value)}
                          placeholder={`Their share (e.g. ${transaction ? (transaction.amount / 2).toFixed(2) : "0.00"})`}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40"
                        />

                        <input
                          type="text"
                          value={newShareNote}
                          onChange={(e) => setNewShareNote(e.target.value)}
                          placeholder="Note (optional — e.g. BWW wings night)"
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40"
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={handleAddShare}
                            disabled={savingShare || !newShareContactId || !newShareAmount}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-honey/[0.12] border border-honey/25 text-honey text-[11px] font-semibold hover:bg-honey/[0.18] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingShare ? "Saving…" : "Save share"}
                          </button>
                          <button
                            onClick={() => { setAddingShare(false); setNewShareContactId(""); setNewShareAmount(""); setNewShareNote(""); }}
                            className="px-3 py-1.5 rounded-lg text-[11px] text-ink-tertiary bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingShare(true)}
                        className="flex items-center gap-1.5 text-[11px] text-ink-ghost hover:text-honey transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Share this expense
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Similar transactions */}
            {(loadingSimilar || similarTxns.length > 0) && (
              <div className="px-5 py-5">
                <p className="text-[12px] font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                  Similar Transactions
                </p>
                {loadingSimilar ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {similarTxns.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => onSelectTransaction?.(t)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors",
                            onSelectTransaction && "cursor-pointer"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-ink-primary truncate">
                              {t.merchant ?? t.raw_description}
                            </p>
                            <p className="text-[11px] text-ink-tertiary">{fmtDate(t.date)}</p>
                          </div>
                          <span className="text-[12px] font-mono font-medium text-ink-secondary ml-3 tabular-nums">
                            {fmt(Math.abs(t.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                    {transaction?.merchant && (
                      <Link
                        href={`/merchants?m=${encodeURIComponent(transaction.merchant)}`}
                        className="flex items-center justify-center gap-1 mt-2 text-[11px] text-ink-tertiary hover:text-honey transition-colors no-underline"
                        onClick={onClose}
                      >
                        View all {transaction.merchant} transactions
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
