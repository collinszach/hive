"use client";

import { useEffect, useState, FormEvent } from "react";
import { api, Account, CategorizationRule, Tag as TagType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Settings2, Plus, Trash2, Edit2, Check, X, Tag, Shield, Database, ChevronRight, CreditCard } from "lucide-react";
import { toast } from "@/components/Toast";
import { ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";

const MATCH_TYPES = [
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "exact", label: "Exact match" },
  { value: "regex", label: "Regex" },
  { value: "amount_range", label: "Amount range" },
];

type Tab = "rules" | "tags" | "data" | "cards";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("rules");

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Settings</h1>
        <p className="text-[13px] text-ink-tertiary mt-0.5">Customize Hive to your preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-elevated rounded-xl p-1 w-fit">
        {([
          { value: "rules", label: "Categorization Rules", icon: Tag },
          { value: "tags",  label: "Tags",                 icon: Tag },
          { value: "data",  label: "Data",                 icon: Database },
          { value: "cards", label: "Card Billing Dates",   icon: CreditCard },
        ] as { value: Tab; label: string; icon: React.ElementType }[]).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors",
              tab === value ? "bg-white/[0.07] text-ink-primary" : "text-ink-tertiary hover:text-ink-secondary"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "rules"  && <RulesTab />}
      {tab === "tags"   && <TagsTab />}
      {tab === "data"   && <DataTab />}
      {tab === "cards"  && <CardsTab />}
    </div>
  );
}

function RulesTab() {
  const [rules, setRules]     = useState<CategorizationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  // Form state
  const [matchType, setMatchType]   = useState("contains");
  const [matchValue, setMatchValue] = useState("");
  const [category, setCategory]     = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [priority, setPriority]     = useState("100");

  async function load() {
    try {
      const data = await api.rules.list();
      setRules(data);
    } catch {
      toast.error("Failed to load rules");
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.rules.create({
        match_type: matchType,
        match_value: matchValue,
        category,
        subcategory: subcategory || null,
        priority: parseInt(priority),
        amount_min: null,
        amount_max: null,
      });
      setShowForm(false);
      setMatchValue(""); setCategory(""); setSubcategory(""); setPriority("100");
      await load();
      toast.success("Rule created");
    } catch {
      toast.error("Failed to create rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: CategorizationRule) {
    try {
      await api.rules.update(rule.id, { is_active: !rule.is_active });
      await load();
    } catch {
      toast.error("Failed to update rule");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.rules.delete(id);
      await load();
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  }

  async function handleApplyRules() {
    setApplying(true);
    try {
      await api.plaid.applyRules();
      setApplied(true);
      toast.success("Rules queued — transactions will update shortly");
      setTimeout(() => setApplied(false), 4000);
    } catch {
      toast.error("Failed to apply rules");
    } finally {
      setApplying(false);
    }
  }

  const subcats = SUBCATEGORIES[category] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-tertiary">
          Custom rules run first in the categorization pipeline. Lower priority number = higher precedence.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApplyRules}
            disabled={applying}
            className="hive-btn-secondary text-[13px] py-2 px-4"
          >
            {applied ? "Queued ✓" : applying ? "Queueing…" : "Apply to all transactions"}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="hive-btn-primary text-[13px] py-2 px-4">
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>

      {showForm && (
        <div className="hive-card p-5">
          <h3 className="text-[14px] font-semibold text-ink-primary mb-4">New Rule</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="hive-label block mb-2">Match Type</label>
                <select value={matchType} onChange={(e) => setMatchType(e.target.value)} className="hive-select w-full">
                  {MATCH_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="hive-label block mb-2">Match Value</label>
                <input
                  type="text"
                  value={matchValue}
                  onChange={(e) => setMatchValue(e.target.value)}
                  required
                  placeholder={matchType === "regex" ? "(?i)starbucks" : "starbucks"}
                  className="hive-input w-full font-mono text-[12px]"
                />
              </div>
              <div>
                <label className="hive-label block mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
                  required
                  className="hive-select w-full"
                >
                  <option value="">Select…</option>
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="hive-label block mb-2">Subcategory (optional)</label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  disabled={!category}
                  className="hive-select w-full disabled:opacity-40"
                >
                  <option value="">Any</option>
                  {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="hive-label block mb-2">Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  min="1"
                  max="999"
                  className="hive-input w-full font-mono"
                />
                <p className="mt-1 text-[11px] text-ink-tertiary/60">Lower = higher priority (default: 100)</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="hive-btn-primary">
                {saving ? "Saving…" : "Create Rule"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="hive-btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="hive-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-tertiary text-[13px]">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center">
            <Tag className="w-8 h-8 text-ink-tertiary/30 mx-auto mb-2" />
            <p className="text-[13px] text-ink-tertiary">No custom rules yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5 transition-colors",
                  !rule.is_active && "opacity-40"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-honey bg-honey/[0.08] px-2 py-0.5 rounded-full">
                      {MATCH_TYPES.find((m) => m.value === rule.match_type)?.label ?? rule.match_type}
                    </span>
                    <span className="text-[11px] text-ink-tertiary">priority {rule.priority}</span>
                  </div>
                  <p className="text-[13px] font-mono text-ink-primary truncate">{rule.match_value}</p>
                  <p className="text-[11px] text-ink-tertiary">
                    → {rule.category}{rule.subcategory ? ` / ${rule.subcategory}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(rule)}
                  className={cn(
                    "text-[11px] font-medium px-3 py-1 rounded-lg transition-colors",
                    rule.is_active
                      ? "bg-semantic-income/[0.08] text-semantic-income"
                      : "bg-white/[0.05] text-ink-tertiary"
                  )}
                >
                  {rule.is_active ? "Active" : "Off"}
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 rounded-lg text-ink-tertiary hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors"
                >
                  <Trash2 className="w-[14px] h-[14px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagsTab() {
  const [tags, setTags]         = useState<TagType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.tags.list()
      .then(setTags)
      .catch(() => toast.error("Failed to load tags"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    setCreating(true);
    try {
      const tag = await api.tags.create(name);
      setTags((prev) => prev.some((t) => t.id === tag.id) ? prev : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      toast.success(`Tag "${name}" created`);
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.tags.delete(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tag deleted");
    } catch {
      toast.error("Failed to delete tag");
    }
  }

  return (
    <div className="space-y-4">
      <div className="hive-card p-5">
        <p className="hive-label mb-3">Create Tag</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. reimbursable, vacation-2025, business"
            className="hive-input flex-1 text-[13px]"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="hive-btn-primary py-2 px-4 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      <div className="hive-card">
        {loading ? (
          <div className="px-5 py-8 text-center text-[12px] text-ink-tertiary">Loading tags…</div>
        ) : tags.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[13px] text-ink-secondary mb-1">No tags yet</p>
            <p className="text-[11px] text-ink-tertiary">Tags can be created above or directly from any transaction drawer.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between px-5 py-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-honey/[0.08] text-honey border border-honey/20">
                  {tag.name}
                </span>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-semantic-expense hover:bg-semantic-expense/[0.08] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DataTab() {
  return (
    <div className="space-y-3">
      <div className="hive-card divide-y divide-white/[0.04]">
        {[
          { label: "Export all transactions", description: "Download a CSV of your full transaction history", href: "/api/reports/tax-export" },
          { label: "Plaid connections", description: "Manage linked bank accounts and credentials", href: "/connect" },
        ].map(({ label, description, href }) => (
          <a
            key={label}
            href={href}
            className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors group"
          >
            <div>
              <p className="text-[13px] font-medium text-ink-primary group-hover:text-honey transition-colors">{label}</p>
              <p className="text-[11px] text-ink-tertiary mt-0.5">{description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-tertiary/40" />
          </a>
        ))}
      </div>
    </div>
  );
}

function CardsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, { close: string; due: string; limit: string; autopay: boolean }>>({});

  useEffect(() => {
    api.accounts.list()
      .then((accts) => {
        const cards = accts.filter((a) => a.type === "credit" && a.is_active);
        setAccounts(cards);
        const init: Record<string, { close: string; due: string; limit: string; autopay: boolean }> = {};
        for (const a of cards) {
          init[a.id] = {
            close: a.statement_close_day?.toString() ?? "",
            due: a.payment_due_day?.toString() ?? "",
            limit: a.credit_limit?.toString() ?? "",
            autopay: a.autopay ?? false,
          };
        }
        setVals(init);
      })
      .catch(() => toast.error("Failed to load accounts"));
  }, []);

  async function handleSave(accountId: string) {
    const v = vals[accountId];
    if (!v) return;
    const closeDay = v.close ? parseInt(v.close) : null;
    const dueDay = v.due ? parseInt(v.due) : null;
    const creditLimit = v.limit ? parseFloat(v.limit) : null;
    if (closeDay !== null && (closeDay < 1 || closeDay > 31)) {
      toast.error("Statement close day must be 1–31");
      return;
    }
    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      toast.error("Payment due day must be 1–31");
      return;
    }
    setSaving(accountId);
    try {
      await api.accounts.updateBilling(accountId, closeDay, dueDay, creditLimit ?? undefined, vals[accountId]?.autopay);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="hive-card overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.04]">
        <p className="text-[13px] font-medium text-ink-primary">Card Billing Dates</p>
        <p className="text-[11px] text-ink-tertiary mt-0.5">
          Used in the Position page to show payment due dates and upcoming obligations.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12px] text-ink-tertiary">
          No active credit card accounts found.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {accounts.map((acct) => {
            const v = vals[acct.id] ?? { close: "", due: "", limit: "", autopay: false };
            return (
              <div key={acct.id} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-primary truncate">{acct.name}</p>
                    {acct.mask && <p className="text-[11px] text-ink-ghost">••{acct.mask}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div>
                      <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Statement closes</p>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={v.close}
                        onChange={(e) => setVals((prev) => ({ ...prev, [acct.id]: { ...prev[acct.id], close: e.target.value } }))}
                        placeholder="day"
                        className="hive-input w-16 text-[12px] text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Payment due</p>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={v.due}
                        onChange={(e) => setVals((prev) => ({ ...prev, [acct.id]: { ...prev[acct.id], due: e.target.value } }))}
                        placeholder="day"
                        className="hive-input w-16 text-[12px] text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Credit limit</p>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={v.limit}
                        onChange={(e) => setVals((prev) => ({ ...prev, [acct.id]: { ...prev[acct.id], limit: e.target.value } }))}
                        placeholder="amount"
                        className="hive-input w-24 text-[12px] text-center"
                      />
                    </div>
                    <div className="mt-5">
                      <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Auto-pay</p>
                      <button
                        onClick={() => setVals((prev) => ({ ...prev, [acct.id]: { ...prev[acct.id], autopay: !prev[acct.id]?.autopay } }))}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative",
                          v.autopay ? "bg-semantic-income" : "bg-white/[0.08]"
                        )}
                        aria-label="Toggle auto-pay"
                      >
                        <span className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                          v.autopay ? "translate-x-5" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                    <button
                      onClick={() => handleSave(acct.id)}
                      disabled={saving === acct.id}
                      className="hive-btn-primary mt-5 text-[11px] py-1.5 px-4 disabled:opacity-50"
                    >
                      {saving === acct.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
