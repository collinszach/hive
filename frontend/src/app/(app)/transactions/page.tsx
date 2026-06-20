"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, Transaction, Tag as TagType, Contact, ExpenseShare, Account } from "@/lib/api";
import { fmt, fmtDate, currentMonth } from "@/lib/utils";
import { cn, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Check, X, Pencil, Tag, EyeOff, FileText, Plus, Trash2, Download, ChevronDown, Users } from "lucide-react";
import { FilterPills } from "@/components/FilterPills";
import { MonthPicker } from "@/components/MonthPicker";
import { toast } from "@/components/Toast";

// ── Filter pill options ─────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { label: "Food & Drink",    value: "Food & Drink" },
  { label: "Groceries",       value: "Groceries" },
  { label: "Travel",          value: "Travel" },
  { label: "Shopping",        value: "Shopping" },
  { label: "Entertainment",   value: "Entertainment" },
  { label: "Health",          value: "Health" },
  { label: "Utilities",       value: "Utilities" },
  { label: "Transportation",  value: "Transportation" },
  { label: "Home",            value: "Home" },
  { label: "Education",       value: "Education" },
  { label: "Personal Care",   value: "Personal Care" },
  { label: "Business",        value: "Business" },
  { label: "Income",          value: "Income" },
  { label: "Transfers",       value: "Transfers" },
];

// ── Card Badge ─────────────────────────────────────────────────────────────

function CardBadge({ cardSlug, accountName }: { cardSlug: string | null; accountName: string | null }) {
  const label = accountName ?? cardSlug ?? "—";
  return (
    <span
      className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
      style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid #2A2D35" }}
    >
      {label}
    </span>
  );
}

// ── Category Badge ─────────────────────────────────────────────────────────

const CAT_DOT_COLOR: Record<string, string> = {
  "Food & Drink":   "#c2663a",
  "Groceries":      "#2d9e72",
  "Travel":         "#2e8fb5",
  "Transportation": "#b89a2a",
  "Entertainment":  "#7c6ab8",
  "Shopping":       "#a8527a",
  "Health":         "#b84f6a",
  "Utilities":      "#6b7285",
  "Home":           "#2a9090",
  "Education":      "#5a67b8",
  "Personal Care":  "#a050b0",
  "Income":         "#2d9e72",
  "Transfers":      "#6b7285",
  "Uncategorized":  "#6b7285",
};

function CategoryBadge({ category }: { category: string | null }) {
  const dotColor = CAT_DOT_COLOR[category ?? ""] ?? "#6b7285";
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid #2A2D35" }}>
      <span
        className="inline-block w-[5px] h-[5px] rounded-full mr-1.5 shrink-0"
        style={{ background: dotColor }}
      />
      {category ?? "—"}
    </span>
  );
}

// ── Inline Merchant Editor ──────────────────────────────────────────────────

function MerchantCell({
  tx,
  onSave,
}: {
  tx: Transaction;
  onSave: (id: string, merchant: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tx.merchant ?? tx.raw_description);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (tx.merchant ?? tx.raw_description)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await api.transactions.patch(tx.id, { merchant: trimmed });
      onSave(tx.id, trimmed);
      setEditing(false);
    } catch {
      toast.error("Failed to update merchant name");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(tx.merchant ?? tx.raw_description);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="text-[13px] bg-elevated border border-honey/30 rounded-lg px-2 py-0.5 text-ink-primary
                     focus:outline-none focus:border-honey/50 w-40"
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center justify-center w-5 h-5 rounded text-honey hover:bg-honey/[0.12] disabled:opacity-40 transition-colors"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={cancel}
          className="flex items-center justify-center w-5 h-5 rounded text-ink-tertiary hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="group flex items-center gap-1.5 text-left w-full"
    >
      {tx.logo_url && (
        <img src={tx.logo_url} alt="" className="h-5 w-5 rounded-full object-cover shrink-0 opacity-80" />
      )}
      <span className="text-[13px] text-ink-primary truncate">
        {tx.merchant ?? tx.raw_description}
      </span>
      <Pencil className="w-2.5 h-2.5 text-ink-tertiary/0 group-hover:text-ink-tertiary/50 transition-colors shrink-0" />
      {tx.notes && (
        <span title={tx.notes} className="shrink-0">
          <FileText className="w-2.5 h-2.5 text-ink-ghost/60" />
        </span>
      )}
      {tx.pending && (
        <span className="shrink-0 text-[10px] text-honey/70 font-medium">pending</span>
      )}
    </button>
  );
}

// ── Inline Transaction Editor ────────────────────────────────────────────

function InlineTransactionEditor({
  transaction,
  onClose,
  onCategoryChange,
}: {
  transaction: Transaction;
  onClose: () => void;
  onCategoryChange?: (id: string, category: string, subcategory: string | null) => void;
}) {
  const [category, setCategory] = useState(transaction.category ?? "Uncategorized");
  const [subcategory, setSubcategory] = useState(transaction.subcategory ?? "");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesCommittedRef = useRef(transaction.notes ?? "");
  const [rememberSaving, setRememberSaving] = useState(false);
  const [rememberDone, setRememberDone] = useState(false);
  const [txTags, setTxTags] = useState<TagType[]>([]);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [tagInput, setTagInput] = useState("");
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
      .catch(() => {});
  }, [transaction.id]);

  const subcategoryOptions = SUBCATEGORIES[category] ?? [];

  async function handleSave() {
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
    if (notes.trim() !== notesCommittedRef.current && !savingNotes) handleSaveNotes();
  }

  async function handleRemember() {
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

  async function applyTag(tag: TagType) {
    if (txTags.some((t) => t.id === tag.id)) return;
    try {
      await api.tags.add(transaction.id, tag.id);
      setTxTags((prev) => [...prev, tag]);
    } catch { toast.error("Failed to add tag"); }
  }

  async function removeTag(tagId: string) {
    try {
      await api.tags.remove(transaction.id, tagId);
      setTxTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch { toast.error("Failed to remove tag"); }
  }

  async function createAndApplyTag() {
    if (!tagInput.trim()) return;
    const name = tagInput.trim().toLowerCase();
    setTagInput("");
    try {
      const tag = await api.tags.create(name);
      setAllTags((prev) => prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]);
      await applyTag(tag);
    } catch { toast.error("Failed to create tag"); }
  }

  const tagSuggestions = allTags.filter(
    (t) => !txTags.some((tx) => tx.id === t.id) && t.name.includes(tagInput.toLowerCase())
  );

  async function handleAddShare() {
    if (!newShareContactId || !newShareAmount) return;
    setSavingShare(true);
    try {
      const share = await api.shares.create(transaction.id, {
        contact_id: newShareContactId,
        amount: parseFloat(newShareAmount),
        note: newShareNote || undefined,
      });
      setShares((prev) => [...prev, share]);
      setNewShareContactId(""); setNewShareAmount(""); setNewShareNote("");
      setAddingShare(false);
      toast.success("Expense shared");
    } catch { toast.error("Failed to share expense"); }
    finally { setSavingShare(false); }
  }

  async function handleSettleShare(shareId: string) {
    try {
      await api.shares.settle(shareId);
      setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, status: "settled" as const } : s));
      toast.success("Marked as settled");
    } catch { toast.error("Failed to settle"); }
  }

  async function handleDeleteShare(shareId: string) {
    try {
      await api.shares.delete(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch { toast.error("Failed to remove share"); }
  }

  async function handleAddContact() {
    if (!newContactName.trim()) return;
    try {
      const contact = await api.contacts.create(newContactName.trim());
      setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
      setNewShareContactId(contact.id);
      setNewContactName(""); setAddingContact(false);
      toast.success(`Added ${contact.name}`);
    } catch { toast.error("Failed to add contact"); }
  }

  return (
    <div className="bg-[#0D0F15] border-t border-b border-honey/[0.12]">
      {/* Close strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
        <span className="text-[11px] text-ink-tertiary">
          {transaction.merchant ?? transaction.raw_description}
          {" · "}
          <span className={cn("font-mono", transaction.amount < 0 ? "text-semantic-income" : "text-ink-primary")}>
            {transaction.amount < 0 ? "+" : ""}{fmt(Math.abs(transaction.amount))}
          </span>
        </span>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.06] transition-colors text-[14px]">
          ×
        </button>
      </div>

      {/* Main editing grid */}
      <div className="grid grid-cols-3 gap-0 divide-x divide-white/[0.04]">

        {/* ── Col 1: Category ── */}
        <div className="px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold text-ink-ghost uppercase tracking-wider">Category</p>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
          >
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-[#161921]">{cat}</option>
            ))}
          </select>
          {subcategoryOptions.length > 0 && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
            >
              <option value="" className="bg-[#161921]">— subcategory —</option>
              {subcategoryOptions.map((sub) => (
                <option key={sub} value={sub} className="bg-[#161921]">{sub}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold bg-honey/[0.12] border border-honey/25 text-honey hover:bg-honey/[0.18] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleRemember}
              disabled={rememberSaving || rememberDone}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors",
                rememberDone
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
                  : "bg-white/[0.04] border-white/[0.08] text-ink-secondary hover:bg-white/[0.08] hover:text-ink-primary disabled:opacity-50"
              )}
            >
              {rememberDone ? "✓ Saved" : "Remember"}
            </button>
          </div>
        </div>

        {/* ── Col 2: Notes + Tags ── */}
        <div className="px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold text-ink-ghost uppercase tracking-wider">Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add a note…"
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/40 transition-colors resize-none"
          />
          {(notesSaved || savingNotes || notes.trim() !== notesCommittedRef.current) && (
            <p className={cn("text-[10px] text-right -mt-2", notesSaved ? "text-emerald-400" : savingNotes ? "text-ink-tertiary" : "text-ink-ghost")}>
              {notesSaved ? "✓ Saved" : savingNotes ? "Saving…" : "Unsaved"}
            </p>
          )}

          <p className="text-[10px] font-semibold text-ink-ghost uppercase tracking-wider">Tags</p>
          {txTags.length > 0 && (
            <div className="flex flex-wrap gap-1 -mt-1">
              {txTags.map((tag) => (
                <span key={tag.id} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-honey/[0.08] text-honey border border-honey/20">
                  {tag.name}
                  <button onClick={() => removeTag(tag.id)} className="hover:text-white ml-0.5 leading-none">×</button>
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
                  if (exact) applyTag(exact); else createAndApplyTag();
                }
              }}
              placeholder="Add tag… (Enter to create)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/40 transition-colors"
            />
            {tagInput && tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#161921] border border-white/[0.10] rounded-lg overflow-hidden z-20 shadow-xl">
                {tagSuggestions.slice(0, 5).map((tag) => (
                  <button key={tag.id} onClick={() => { applyTag(tag); setTagInput(""); }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-ink-secondary hover:bg-white/[0.06] hover:text-ink-primary transition-colors">
                    {tag.name}
                  </button>
                ))}
                {!allTags.some((t) => t.name === tagInput.trim().toLowerCase()) && (
                  <button onClick={createAndApplyTag}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-honey/70 hover:bg-honey/[0.06] hover:text-honey transition-colors border-t border-white/[0.06]">
                    + Create &ldquo;{tagInput.trim()}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Col 3: Shared With ── */}
        <div className="px-4 py-4">
          <button
            onClick={() => setSharesOpen((o) => !o)}
            className="flex items-center gap-2 w-full text-left mb-3"
          >
            <Users className="w-3 h-3 text-ink-ghost" />
            <span className="text-[10px] font-semibold text-ink-ghost uppercase tracking-wider">Shared with</span>
            {shares.filter((s) => s.status === "pending").length > 0 && (
              <span className="text-[9px] font-bold bg-honey/20 text-honey px-1.5 py-0.5 rounded ml-1">
                {shares.filter((s) => s.status === "pending").length} pending
              </span>
            )}
            <ChevronDown className={cn("w-3 h-3 text-ink-ghost ml-auto transition-transform", sharesOpen && "rotate-180")} />
          </button>

          {sharesOpen && (
            <div className="space-y-2">
              {shares.map((share) => (
                <div key={share.id} className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]",
                  share.status === "settled" ? "bg-white/[0.02] opacity-60" : "bg-white/[0.04]"
                )}>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink-primary">{share.contact_name}</p>
                    {share.note && <p className="text-[10px] text-ink-ghost truncate">{share.note}</p>}
                  </div>
                  <p className="font-mono text-ink-primary tabular-nums shrink-0">{fmt(share.amount)}</p>
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
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-2.5 space-y-2">
                  {!addingContact ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={newShareContactId}
                        onChange={(e) => setNewShareContactId(e.target.value)}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-ink-primary flex-1 focus:outline-none focus:border-honey/40"
                      >
                        <option value="">— who owes you? —</option>
                        {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button onClick={() => setAddingContact(true)} className="text-[10px] text-ink-ghost hover:text-honey transition-colors shrink-0">+ New</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input autoFocus type="text" value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                        placeholder="Name (e.g. Anthony)"
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40"
                      />
                      <button onClick={handleAddContact} className="text-[10px] text-honey shrink-0">Save</button>
                      <button onClick={() => setAddingContact(false)} className="text-[10px] text-ink-ghost shrink-0">Cancel</button>
                    </div>
                  )}
                  <input type="number" step="0.01" min="0" value={newShareAmount}
                    onChange={(e) => setNewShareAmount(e.target.value)}
                    placeholder={`Their share (e.g. ${(transaction.amount / 2).toFixed(2)})`}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40"
                  />
                  <input type="text" value={newShareNote} onChange={(e) => setNewShareNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:border-honey/40"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddShare} disabled={savingShare || !newShareContactId || !newShareAmount}
                      className="flex-1 py-1 px-2 rounded-lg bg-honey/[0.12] border border-honey/25 text-honey text-[10px] font-semibold hover:bg-honey/[0.18] transition-colors disabled:opacity-50">
                      {savingShare ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setAddingShare(false); setNewShareContactId(""); setNewShareAmount(""); setNewShareNote(""); }}
                      className="px-2 py-1 rounded-lg text-[10px] text-ink-tertiary bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingShare(true)}
                  className="flex items-center gap-1.5 text-[11px] text-ink-ghost hover:text-honey transition-colors">
                  <Plus className="w-3 h-3" /> Share this expense
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [month, setMonth] = useState(() => searchParams.get("month") ?? currentMonth());
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [categories, setCategories] = useState<string[]>(() => {
    const p = searchParams.get("category");
    return p ? p.split(",").map((c) => c.trim()).filter(Boolean) : [];
  });
  const [subcategory, setSubcategory] = useState(() => searchParams.get("subcategory") ?? "");
  const [accountId, setAccountId] = useState<string | null>(() => searchParams.get("account_id"));
  const [page, setPage] = useState(1);
  const [includePending, setIncludePending] = useState(() => searchParams.get("include_pending") === "true");
  const [includeExcluded, setIncludeExcluded] = useState(() => searchParams.get("include_excluded") === "true");
  const [searchAll, setSearchAll] = useState(() => searchParams.get("search_all") === "true");
  const openTxId = searchParams.get("open_tx");
  const openTxDoneRef = useRef(false);
  const [useCustomRange, setUseCustomRange] = useState(() => !!searchParams.get("start_date"));
  const [startDate, setStartDate] = useState(() => {
    const p = searchParams.get("start_date");
    if (p) return p;
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => searchParams.get("end_date") ?? new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ items: Transaction[]; total: number; total_amount: number; page: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCatOpen, setBulkCatOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addMerchant, setAddMerchant] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addSubcategory, setAddSubcategory] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    api.tags.list().then(setAllTags).catch(() => {});
    api.accounts.list().then((accts) => setAllAccounts(accts.filter((a) => a.is_active && !a.is_excluded))).catch(() => {});
  }, []);

  async function handleRecategorize() {
    setRecategorizing(true);
    try {
      const res = await fetch("/api/transactions/recategorize", { method: "POST", credentials: "include" });
      if (res.ok) {
        toast.success("Recategorization queued — transactions will update shortly");
      } else {
        toast.error("Failed to queue recategorization");
      }
    } catch {
      toast.error("Network error — check your connection");
    } finally {
      setRecategorizing(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.transactions.list({
        month: searchAll || useCustomRange ? undefined : month,
        start_date: useCustomRange ? startDate : undefined,
        end_date: useCustomRange ? endDate : undefined,
        search: search || undefined,
        search_all: searchAll || undefined,
        category: categories.length > 0 ? categories.join(",") : undefined,
        subcategory: subcategory || undefined,
        account_id: accountId || undefined,
        tag_id: tagFilter || undefined,
        include_pending: includePending,
        include_excluded: includeExcluded,
        page,
        page_size: 50,
      });
      setData(res);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [month, search, searchAll, useCustomRange, startDate, endDate, categories, subcategory, accountId, tagFilter, page, includePending, includeExcluded]);

  useEffect(() => { load(); }, [load]);

  // Auto-open drawer when deep-linked (?open_tx=<id>)
  // Falls back to a direct fetch if the transaction isn't in the current page.
  useEffect(() => {
    if (!openTxId || openTxDoneRef.current || !data) return;
    const target = data.items.find((t) => t.id === openTxId);
    if (target) {
      setSelectedTx(target);
      openTxDoneRef.current = true;
    } else if (!loading) {
      // Not on this page — fetch it directly
      openTxDoneRef.current = true;
      api.transactions.getById(openTxId)
        .then((tx) => setSelectedTx(tx))
        .catch(() => { /* silently fail — bad/expired ID */ });
    }
  }, [data, openTxId, loading]);

  // J/K keyboard navigation between transactions when drawer is open
  useEffect(() => {
    if (!selectedTx || !data) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!data || !selectedTx) return;
      const active = document.activeElement;
      // Don't intercept if focus is in an input/textarea/select
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
      const items = data.items;
      const idx = items.findIndex((t) => t.id === selectedTx.id);
      if (e.key === "j" || e.key === "ArrowDown") {
        if (idx < items.length - 1) { e.preventDefault(); setSelectedTx(items[idx + 1]); }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        if (idx > 0) { e.preventDefault(); setSelectedTx(items[idx - 1]); }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTx, data]);

  function handleMerchantSaved(id: string, merchant: string) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((t) => t.id === id ? { ...t, merchant } : t) } : prev
    );
  }

  function handleCategoryChanged(id: string, cat: string, sub: string | null) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((t) =>
              t.id === id ? { ...t, category: cat, subcategory: sub, category_source: "manual" } : t
            ),
          }
        : prev
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    const allIds = data.items.map((t) => t.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }

  async function handleBulkCategorize() {
    if (!bulkCategory || selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      await api.transactions.bulkUpdate([...selectedIds], {
        category: bulkCategory,
        subcategory: bulkSubcategory || null,
      });
      setData((prev) =>
        prev ? {
          ...prev,
          items: prev.items.map((t) =>
            selectedIds.has(t.id)
              ? { ...t, category: bulkCategory, subcategory: bulkSubcategory || null, category_source: "manual" }
              : t
          ),
        } : prev
      );
      toast.success(`${selectedIds.size} transaction${selectedIds.size !== 1 ? "s" : ""} recategorized`);
      setSelectedIds(new Set());
      setBulkCatOpen(false);
    } catch {
      toast.error("Failed to recategorize transactions");
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkExclude() {
    if (selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      await api.transactions.bulkUpdate([...selectedIds], { is_excluded: true });
      setData((prev) =>
        prev ? {
          ...prev,
          items: prev.items.map((t) =>
            selectedIds.has(t.id) ? { ...t, is_excluded: true } : t
          ),
        } : prev
      );
      toast.success(`${selectedIds.size} transaction${selectedIds.size !== 1 ? "s" : ""} excluded`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to exclude transactions");
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleAddManual() {
    const amt = parseFloat(addAmount);
    if (!addMerchant.trim() || isNaN(amt)) return;
    setAddSaving(true);
    try {
      const tx = await api.transactions.createManual({
        date: addDate,
        amount: amt,
        merchant: addMerchant.trim(),
        category: addCategory || null,
        subcategory: addSubcategory || null,
        notes: addNotes.trim() || null,
      });
      setData((prev) => prev ? { ...prev, items: [tx, ...prev.items], total: prev.total + 1 } : prev);
      setShowAddForm(false);
      setAddMerchant(""); setAddAmount(""); setAddCategory(""); setAddSubcategory(""); setAddNotes("");
      setAddDate(new Date().toISOString().slice(0, 10));
      toast.success("Transaction added");
    } catch {
      toast.error("Failed to add transaction");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDeleteManual(id: string) {
    try {
      await api.transactions.delete(id);
      setData((prev) => prev ? { ...prev, items: prev.items.filter((t) => t.id !== id), total: prev.total - 1 } : prev);
      if (selectedTx?.id === id) setSelectedTx(null);
      toast.success("Transaction deleted");
    } catch {
      toast.error("Cannot delete imported transactions");
    }
  }

  const months: string[] = [];
  const d = new Date();
  d.setDate(1); // pin to 1st to avoid day-overflow when crossing Feb
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 32 }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-5 flex items-center justify-between gap-2">
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink-primary)", margin: 0 }}>Transactions</h1>
        <div className="flex items-center gap-2">
          {data && (
            <span className="hidden sm:inline text-[12px] text-ink-tertiary font-mono">
              {data.total.toLocaleString()} total
            </span>
          )}
          <button
            onClick={handleRecategorize}
            disabled={recategorizing}
            className="hidden md:inline-flex items-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--border-default)", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "var(--color-ink-secondary)", cursor: recategorizing ? "default" : "pointer", opacity: recategorizing ? 0.5 : 1 }}
          >
            {recategorizing ? "Queuing…" : "↻ Re-categorize all"}
          </button>
          <a
            href={api.transactions.exportUrl({
              month: searchAll || useCustomRange ? undefined : month,
              start_date: useCustomRange ? startDate : undefined,
              end_date: useCustomRange ? endDate : undefined,
              category: categories.length > 0 ? categories.join(",") : undefined,
              search: search || undefined,
              include_pending: includePending || undefined,
              include_excluded: includeExcluded || undefined,
            })}
            download
            className="flex items-center gap-1.5 hive-btn-secondary py-1.5 px-3 text-[12px]"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 hive-btn-primary py-1.5 px-3 text-[12px]"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-4 flex flex-col gap-4">

      {/* ── Quick-Add Form ────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="hive-card p-4 animate-fade-in">
          <p className="text-[13px] font-semibold text-ink-primary mb-3">Add Manual Transaction</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="hive-label block mb-1">Date</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="hive-input w-full text-[12px]"
              />
            </div>
            <div>
              <label className="hive-label block mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="hive-input w-full text-[12px] font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="hive-label block mb-1">Merchant</label>
              <input
                type="text"
                placeholder="Merchant or description"
                value={addMerchant}
                onChange={(e) => setAddMerchant(e.target.value)}
                className="hive-input w-full text-[12px]"
              />
            </div>
            <div>
              <label className="hive-label block mb-1">Category</label>
              <select value={addCategory} onChange={(e) => { setAddCategory(e.target.value); setAddSubcategory(""); }} className="hive-select w-full text-[12px]">
                <option value="">Select…</option>
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="hive-label block mb-1">Subcategory</label>
              <select value={addSubcategory} onChange={(e) => setAddSubcategory(e.target.value)} disabled={!addCategory} className="hive-select w-full text-[12px] disabled:opacity-40">
                <option value="">Any</option>
                {(SUBCATEGORIES[addCategory] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="hive-label block mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="Reimbursable, cash, etc."
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                className="hive-input w-full text-[12px]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddManual}
              disabled={addSaving || !addMerchant.trim() || !addAmount}
              className="hive-btn-primary text-[12px] py-2 px-4 disabled:opacity-40"
            >
              {addSaving ? "Adding…" : "Add Transaction"}
            </button>
            <button onClick={() => setShowAddForm(false)} className="hive-btn-secondary text-[12px] py-2 px-4">
              Cancel
            </button>
          </div>
        </div>
      )}


      {/* ── Category filter pills ────────────────────────────────────── */}
      <FilterPills
        options={FILTER_OPTIONS}
        value={categories}
        onChange={(v) => { setCategories(v as string[]); setPage(1); }}
        multi
      />

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="hive-card px-4 py-3">
        <div className="flex flex-wrap gap-2 items-center">
          <SlidersHorizontal className="w-[13px] h-[13px] text-ink-tertiary/60 shrink-0" />

          {/* Month picker (hidden when custom range or all-time search active) */}
          {!useCustomRange && !searchAll && (
            <MonthPicker month={month} onChange={(m) => { setMonth(m); setPage(1); }} maxMonth={currentMonth()} />
          )}

          {/* Custom date range (shown when active) */}
          {useCustomRange && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-white/[0.04] border border-white/[0.08] rounded-[9px] px-2.5 py-[7px] text-[12px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
              />
              <span className="text-[11px] text-ink-ghost">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-white/[0.04] border border-white/[0.08] rounded-[9px] px-2.5 py-[7px] text-[12px] text-ink-primary focus:outline-none focus:border-honey/40 transition-colors"
              />
            </div>
          )}
          <button
            onClick={() => { setUseCustomRange(v => !v); setPage(1); setSearchAll(false); }}
            title={useCustomRange ? "Switch to month view" : "Use custom date range"}
            className={cn(
              "px-2.5 py-[7px] rounded-[9px] text-[11px] font-medium border transition-colors",
              useCustomRange
                ? "bg-honey/10 border-honey/30 text-honey"
                : "bg-white/[0.04] border-white/[0.08] text-ink-tertiary hover:text-ink-secondary hover:border-white/[0.14]"
            )}
          >
            Custom
          </button>

          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary/60 pointer-events-none" />
            <input
              type="search"
              placeholder="Search merchant…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-[9px] pl-7 pr-3 py-[7px]
                         text-[12px] text-ink-primary placeholder:text-ink-tertiary/60 min-w-[180px]
                         focus:outline-none focus:border-honey/40 transition-colors"
            />
          </div>

          {search && (
            <label className={cn(
              "flex items-center gap-1.5 text-[12px] cursor-pointer select-none transition-colors px-2.5 py-1 rounded-lg border",
              searchAll
                ? "text-honey bg-honey/[0.08] border-honey/25"
                : "text-ink-tertiary border-white/[0.06] hover:text-ink-secondary hover:border-white/[0.12]"
            )}>
              <input type="checkbox" checked={searchAll} onChange={(e) => { setSearchAll(e.target.checked); setPage(1); }}
                className="hidden" />
              All time
            </label>
          )}

          {allAccounts.length > 1 && (
            <select
              value={accountId ?? ""}
              onChange={(e) => { setAccountId(e.target.value || null); setPage(1); }}
              className="hive-select text-[12px]"
            >
              <option value="">All cards</option>
              {allAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.mask ? ` ••${a.mask}` : ""}
                </option>
              ))}
            </select>
          )}

          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
              className="hive-select text-[12px]"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-3 ml-1">
            <label className="flex items-center gap-1.5 text-[12px] text-ink-tertiary cursor-pointer select-none hover:text-ink-secondary transition-colors">
              <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)}
                className="rounded accent-[#F5B942] w-3 h-3" />
              Pending
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-ink-tertiary cursor-pointer select-none hover:text-ink-secondary transition-colors">
              <input type="checkbox" checked={includeExcluded} onChange={(e) => setIncludeExcluded(e.target.checked)}
                className="rounded accent-[#F5B942] w-3 h-3" />
              Excluded
            </label>
          </div>
        </div>
      </div>

      {/* ── Active category chips ─────────────────────────────────────── */}
      {/* Always-visible, removable chips for every active category. The pills
          above can be scrolled off-screen on mobile, and categories that aren't
          in FILTER_OPTIONS (e.g. "Uncategorized" arriving via a home deep-link)
          have no pill at all — without this row the filter can't be cleared. */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 -mt-1">
          <span className="text-[11px] text-ink-tertiary">Category:</span>
          {categories.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-honey/[0.08] border border-honey/20 text-honey"
            >
              {c}
              <button
                type="button"
                onClick={() => { setCategories(categories.filter((x) => x !== c)); setPage(1); }}
                className="ml-0.5 hover:text-honey/60 transition-colors"
                aria-label={`Clear ${c} filter`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Subcategory filter chip (shown when arriving via deep-link) ─ */}
      {subcategory && (
        <div className="flex items-center gap-1.5 px-1 -mt-1">
          <span className="text-[11px] text-ink-tertiary">Subcategory:</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-honey/[0.08] border border-honey/20 text-honey">
            {subcategory}
            <button
              type="button"
              onClick={() => { setSubcategory(""); setPage(1); }}
              className="ml-0.5 hover:text-honey/60 transition-colors"
              aria-label="Clear subcategory filter"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* ── Summary bar ───────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="flex items-center justify-between px-1 -mt-1 mb-0.5">
          <span className="text-[11px] text-ink-ghost">
            {data.total.toLocaleString()} transaction{data.total !== 1 ? "s" : ""}
          </span>
          {data.total_amount !== 0 && (
            <span className="text-[11px] font-mono text-ink-tertiary tabular-nums">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(data.total_amount)} total
            </span>
          )}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary font-mono">
            {data.total.toLocaleString()} transactions · page {page} of {data.pages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="hive-btn-secondary py-1.5 px-3 text-[12px] disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="hive-btn-secondary py-1.5 px-3 text-[12px] disabled:opacity-30"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="hive-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[580px]">
          <thead className="border-b border-white/[0.05]">
            <tr>
              <th className="pl-4 pr-2 py-3 w-8">
                <input
                  type="checkbox"
                  className="rounded accent-[#F5B942] w-3.5 h-3.5 cursor-pointer"
                  checked={!!data && data.items.length > 0 && data.items.every((t) => selectedIds.has(t.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-2 py-3 text-left w-[90px]">
                <span className="hive-label">Date</span>
              </th>
              <th className="px-2 py-3 text-left">
                <span className="hive-label">Merchant</span>
              </th>
              <th className="px-2 py-3 text-left">
                <span className="hive-label">Category</span>
              </th>
              <th className="px-2 py-3 text-left w-[110px]">
                <span className="hive-label">Card</span>
              </th>
              <th className="px-2 py-3 text-right w-[110px]">
                <span className="hive-label">Amount</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-ink-tertiary">
                  <div className="inline-block animate-pulse text-[13px]">Loading…</div>
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-[13px] text-ink-tertiary">
                  No transactions found
                </td>
              </tr>
            )}
            {!loading && data?.items.map((tx, index) => {
              const isChecked = selectedIds.has(tx.id);
              const isExpanded = selectedTx?.id === tx.id;
              return (
                <>
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx((prev) => prev?.id === tx.id ? null : tx)}
                    className={cn(
                      "group hover:bg-white/[0.02] cursor-pointer transition-colors animate-slide-in-row",
                      isChecked && "bg-honey/[0.04]",
                      isExpanded && "bg-white/[0.02]",
                      tx.is_excluded && "opacity-30",
                      tx.pending && "opacity-55"
                    )}
                    style={index < 10 ? { animationDelay: `${index * 30}ms` } : undefined}
                  >
                    <td className="pl-4 pr-2 py-2.5" onClick={(e) => { e.stopPropagation(); toggleSelect(tx.id); }}>
                      <input
                        type="checkbox"
                        className="rounded accent-[#F5B942] w-3.5 h-3.5 cursor-pointer"
                        checked={isChecked}
                        onChange={() => toggleSelect(tx.id)}
                      />
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className="text-[11px] font-mono text-ink-tertiary/70">{fmtDate(tx.date)}</span>
                    </td>
                    <td className="px-2 py-2.5 max-w-[260px]">
                      <MerchantCell tx={tx} onSave={handleMerchantSaved} />
                    </td>
                    <td className="px-2 py-2.5 min-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <CategoryBadge category={tx.category} />
                        {tx.subcategory && (
                          <span className="text-[10px] text-ink-tertiary/60 truncate max-w-[70px]">
                            {tx.subcategory}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <CardBadge cardSlug={tx.card_slug} accountName={tx.account_name} />
                    </td>
                    <td className={cn(
                      "px-2 py-2.5 text-right font-mono tabular-nums whitespace-nowrap text-[13px] font-semibold",
                      tx.amount < 0 ? "text-semantic-income" : "text-ink-primary"
                    )}>
                      <div className="flex items-center justify-end gap-2">
                        {!tx.plaid_transaction_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteManual(tx.id); }}
                            title="Delete manual transaction"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-ghost hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {tx.amount < 0 ? `+${fmt(Math.abs(tx.amount))}` : fmt(tx.amount)}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${tx.id}-expanded`}>
                      <td colSpan={6} className="p-0">
                        <InlineTransactionEditor
                          transaction={tx}
                          onClose={() => setSelectedTx(null)}
                          onCategoryChange={handleCategoryChanged}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        </div>{/* end overflow-x-auto */}
      </div>

      </div>{/* end body */}

      {/* ── Bulk Action Bar ──────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--color-surface-raised, #1A1E28)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: "10px 14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink-primary)", marginRight: 4 }}>
            {selectedIds.size} selected
          </span>

          {/* Categorize */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setBulkCatOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(245,185,66,0.10)", border: "1px solid rgba(245,185,66,0.25)",
                borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                fontSize: 12, fontWeight: 500, color: "var(--color-honey)",
              }}
            >
              <Tag size={12} /> Categorize
            </button>

            {bulkCatOpen && (
              <div
                style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                  background: "var(--color-surface-raised, #1A1E28)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10, padding: 12, width: 220,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  zIndex: 70,
                }}
              >
                <p style={{ fontSize: 11, color: "var(--color-ink-tertiary)", marginBottom: 8 }}>
                  Set category for {selectedIds.size} transactions
                </p>
                <select
                  value={bulkCategory}
                  onChange={(e) => { setBulkCategory(e.target.value); setBulkSubcategory(""); }}
                  className="hive-select w-full mb-2"
                >
                  <option value="">— pick category —</option>
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(SUBCATEGORIES[bulkCategory] ?? []).length > 0 && (
                  <select
                    value={bulkSubcategory}
                    onChange={(e) => setBulkSubcategory(e.target.value)}
                    className="hive-select w-full mb-2"
                  >
                    <option value="">— subcategory (optional) —</option>
                    {(SUBCATEGORIES[bulkCategory] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <button
                  onClick={handleBulkCategorize}
                  disabled={!bulkCategory || bulkWorking}
                  className="hive-btn-primary w-full py-2 text-[12px] disabled:opacity-40"
                >
                  {bulkWorking ? "Saving…" : `Apply to ${selectedIds.size}`}
                </button>
              </div>
            )}
          </div>

          {/* Exclude */}
          <button
            onClick={handleBulkExclude}
            disabled={bulkWorking}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontSize: 12, fontWeight: 500, color: "var(--color-ink-secondary)",
            }}
          >
            <EyeOff size={12} /> Exclude
          </button>

          {/* Clear */}
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              display: "flex", alignItems: "center",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-ink-tertiary)", padding: "4px 6px",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsPageInner />
    </Suspense>
  );
}
