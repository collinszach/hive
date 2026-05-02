"use client";

import { useEffect, useState } from "react";
import { api, type CategorizationRule } from "@/lib/api";
import { ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { toast } from "@/components/Toast";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Shield,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchType = "contains" | "starts_with" | "exact" | "regex" | "amount_range";

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  contains: "Contains",
  starts_with: "Starts with",
  exact: "Exact match",
  regex: "Regex",
  amount_range: "Amount range",
};

const MATCH_TYPE_HINTS: Record<MatchType, string> = {
  contains: "Matches if the description includes this text (case-insensitive)",
  starts_with: "Matches if the description begins with this text",
  exact: "Matches only if the description is exactly this text",
  regex: "Matches using a regular expression pattern (e.g. (?i)amazon\\.com)",
  amount_range: "Matches transactions within a dollar amount range",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchTypeBadge(mt: string) {
  const colors: Record<string, string> = {
    contains: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    starts_with: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    exact: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    regex: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    amount_range: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  };
  return `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide ${colors[mt] ?? "bg-white/5 text-ink-tertiary border-white/10"}`;
}

function ruleMatchSummary(rule: CategorizationRule) {
  if (rule.match_type === "amount_range") {
    const lo = rule.amount_min != null ? `$${rule.amount_min}` : "–";
    const hi = rule.amount_max != null ? `$${rule.amount_max}` : "–";
    return `${lo} – ${hi}`;
  }
  return rule.match_value || "—";
}

// ── Rule Form ──────────────────────────────────────────────────────────────────

interface RuleFormData {
  match_type: MatchType;
  match_value: string;
  amount_min: string;
  amount_max: string;
  category: string;
  subcategory: string;
  priority: string;
}

const BLANK_FORM: RuleFormData = {
  match_type: "contains",
  match_value: "",
  amount_min: "",
  amount_max: "",
  category: "Food & Drink",
  subcategory: "",
  priority: "100",
};

interface RuleFormProps {
  initial?: RuleFormData;
  onSave: (data: RuleFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function RuleForm({ initial = BLANK_FORM, onSave, onCancel, saving }: RuleFormProps) {
  const [form, setForm] = useState<RuleFormData>(initial);

  function set<K extends keyof RuleFormData>(key: K, val: RuleFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      // Reset subcategory when category changes
      if (key === "category") next.subcategory = "";
      // Reset match_value when switching to amount_range
      if (key === "match_type" && val === "amount_range") next.match_value = "";
      return next;
    });
  }

  const subcatOptions = SUBCATEGORIES[form.category] ?? [];
  const isAmountRange = form.match_type === "amount_range";

  return (
    <div className="space-y-4">
      {/* Match type */}
      <div>
        <label className="block text-xs text-ink-tertiary mb-1.5 uppercase tracking-wide">Match type</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MATCH_TYPE_LABELS) as MatchType[]).map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => set("match_type", mt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                form.match_type === mt
                  ? "bg-honey/15 border-honey/40 text-honey"
                  : "bg-white/[0.04] border-white/[0.08] text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.06]"
              }`}
            >
              {MATCH_TYPE_LABELS[mt]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-ghost mt-1.5">{MATCH_TYPE_HINTS[form.match_type]}</p>
      </div>

      {/* Match value / amount range */}
      {isAmountRange ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-ink-tertiary mb-1 uppercase tracking-wide">Min amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount_min}
              onChange={(e) => set("amount_min", e.target.value)}
              placeholder="0.00"
              className="hive-input w-full font-mono"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-ink-tertiary mb-1 uppercase tracking-wide">Max amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount_max}
              onChange={(e) => set("amount_max", e.target.value)}
              placeholder="999.99"
              className="hive-input w-full font-mono"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-ink-tertiary mb-1 uppercase tracking-wide">Match value</label>
          <input
            type="text"
            value={form.match_value}
            onChange={(e) => set("match_value", e.target.value)}
            placeholder={
              form.match_type === "regex"
                ? "(?i)amazon\\.com|amazon mktp"
                : form.match_type === "exact"
                ? "AMAZON.COM*ABCD1234"
                : "amazon"
            }
            className="hive-input w-full font-mono"
          />
        </div>
      )}

      {/* Category + Subcategory */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-ink-tertiary mb-1 uppercase tracking-wide">Category</label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="hive-select w-full"
          >
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-ink-tertiary mb-1 uppercase tracking-wide">Subcategory</label>
          <select
            value={form.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
            disabled={subcatOptions.length === 0}
            className="hive-select w-full disabled:opacity-40"
          >
            <option value="">(none)</option>
            {subcatOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs text-ink-tertiary mb-1 uppercase tracking-wide">Priority</label>
        <input
          type="number"
          min="1"
          max="999"
          value={form.priority}
          onChange={(e) => set("priority", e.target.value)}
          className="hive-input w-28 font-mono"
        />
        <p className="text-[11px] text-ink-ghost mt-1">Lower number = checked first. Rules with same priority are ordered by creation date.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving}
          className="hive-btn-primary disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save rule"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="hive-btn-secondary disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Rule Row ──────────────────────────────────────────────────────────────────

interface RuleRowProps {
  rule: CategorizationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  busy: boolean;
}

function RuleRow({ rule, onEdit, onDelete, onToggle, busy }: RuleRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-opacity ${!rule.is_active ? "opacity-50" : ""}`}>
      {/* Priority bubble */}
      <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-mono text-ink-tertiary">{rule.priority}</span>
      </div>

      {/* Match type badge + value */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={matchTypeBadge(rule.match_type)}>{rule.match_type.replace("_", " ")}</span>
          <span className="text-sm font-mono text-ink-primary truncate">{ruleMatchSummary(rule)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
          <span className="text-honey/80">{rule.category}</span>
          {rule.subcategory && (
            <>
              <span className="text-ink-ghost">/</span>
              <span>{rule.subcategory}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-[11px] text-semantic-expense">Delete?</span>
            <button
              onClick={handleDeleteClick}
              disabled={busy}
              className="px-2 py-1 rounded-md text-[11px] font-medium text-semantic-expense bg-semantic-expense/10 hover:bg-semantic-expense/20 transition-colors disabled:opacity-40"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
              className="px-2 py-1 rounded-md text-[11px] font-medium text-ink-tertiary hover:text-ink-secondary transition-colors disabled:opacity-40"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggle}
              disabled={busy}
              title={rule.is_active ? "Disable rule" : "Enable rule"}
              className="p-1.5 rounded-md text-ink-ghost hover:text-ink-secondary transition-colors disabled:opacity-40"
            >
              {rule.is_active
                ? <ToggleRight className="w-4 h-4 text-semantic-income/70" />
                : <ToggleLeft className="w-4 h-4" />
              }
            </button>
            <button
              onClick={onEdit}
              disabled={busy}
              className="p-1.5 rounded-md text-ink-ghost hover:text-honey transition-colors disabled:opacity-40"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={busy}
              className="p-1.5 rounded-md text-ink-ghost hover:text-semantic-expense transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    api.rules
      .list()
      .then(setRules)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function formDataToPayload(form: RuleFormData) {
    return {
      match_type: form.match_type,
      match_value: form.match_type === "amount_range" ? "" : form.match_value.trim(),
      amount_min: form.match_type === "amount_range" && form.amount_min ? parseFloat(form.amount_min) : null,
      amount_max: form.match_type === "amount_range" && form.amount_max ? parseFloat(form.amount_max) : null,
      category: form.category,
      subcategory: form.subcategory || null,
      priority: parseInt(form.priority, 10) || 100,
    };
  }

  async function handleCreate(form: RuleFormData) {
    setSavingId("new");
    try {
      const created = await api.rules.create(formDataToPayload(form));
      setRules((prev) => [...prev, created].sort((a, b) => a.priority - b.priority));
      setShowAdd(false);
      toast.success("Rule created");
    } catch {
      toast.error("Failed to create rule");
    } finally {
      setSavingId(null);
    }
  }

  async function handleUpdate(id: string, form: RuleFormData) {
    setSavingId(id);
    try {
      const updated = await api.rules.update(id, formDataToPayload(form));
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)).sort((a, b) => a.priority - b.priority));
      setEditingId(null);
      toast.success("Rule updated");
    } catch {
      toast.error("Failed to update rule");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    try {
      await api.rules.delete(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggle(rule: CategorizationRule) {
    setSavingId(rule.id);
    try {
      const updated = await api.rules.update(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch {
      toast.error("Failed to toggle rule");
    } finally {
      setSavingId(null);
    }
  }

  async function handleApplyRules() {
    setApplying(true);
    try {
      const res = await api.plaid.applyRules();
      toast.success(res.message || "Rules applied to all transactions");
    } catch {
      toast.error("Failed to apply rules");
    } finally {
      setApplying(false);
    }
  }

  function ruleToForm(rule: CategorizationRule): RuleFormData {
    return {
      match_type: rule.match_type as MatchType,
      match_value: rule.match_value || "",
      amount_min: rule.amount_min != null ? String(rule.amount_min) : "",
      amount_max: rule.amount_max != null ? String(rule.amount_max) : "",
      category: rule.category,
      subcategory: rule.subcategory || "",
      priority: String(rule.priority),
    };
  }

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Categorization"
        headline={
          <>
            <span className="text-honey">{rules.length}</span> custom rules
          </>
        }
        subtext="Auto-categorize transactions by merchant name, pattern, or amount range"
        statStrip={[
          { label: "Total rules", value: String(rules.length), color: "default" },
          { label: "Active", value: String(activeCount), color: "green" },
          { label: "Inactive", value: String(rules.length - activeCount), color: "default" },
        ]}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="hive-btn-primary"
        >
          <Plus className="w-4 h-4" />
          New rule
        </button>
        <button
          onClick={handleApplyRules}
          disabled={applying}
          className="hive-btn-secondary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${applying ? "animate-spin" : ""}`} />
          {applying ? "Applying…" : "Apply rules now"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="hive-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-honey" />
            <h3 className="text-sm font-semibold text-ink-primary">New rule</h3>
          </div>
          <RuleForm
            onSave={handleCreate}
            onCancel={() => setShowAdd(false)}
            saving={savingId === "new"}
          />
        </div>
      )}

      {/* Rules list */}
      {loading && (
        <div className="text-center text-ink-tertiary py-16 text-sm animate-pulse">Loading rules…</div>
      )}

      {error && (
        <div className="hive-card p-4 text-semantic-expense text-sm">{error}</div>
      )}

      {!loading && !error && rules.length === 0 && !showAdd && (
        <div className="hive-card py-16 text-center">
          <Shield className="w-10 h-10 text-honey/30 mx-auto mb-3" />
          <p className="text-ink-secondary font-medium">No custom rules yet</p>
          <p className="text-ink-tertiary text-sm mt-1 mb-4">
            Rules run before AI categorization — great for merchants that Plaid mis-labels.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-honey hover:text-honey/80 transition-colors"
          >
            Create your first rule →
          </button>
        </div>
      )}

      {rules.length > 0 && (
        <div className="hive-card overflow-hidden divide-y divide-white/[0.04]">
          {rules.map((rule) =>
            editingId === rule.id ? (
              <div key={rule.id} className="p-5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <Pencil className="w-3.5 h-3.5 text-honey" />
                  <h3 className="text-sm font-semibold text-ink-primary">Edit rule</h3>
                </div>
                <RuleForm
                  initial={ruleToForm(rule)}
                  onSave={(form) => handleUpdate(rule.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={savingId === rule.id}
                />
              </div>
            ) : (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={() => { setEditingId(rule.id); setShowAdd(false); }}
                onDelete={() => handleDelete(rule.id)}
                onToggle={() => handleToggle(rule)}
                busy={savingId === rule.id}
              />
            )
          )}
        </div>
      )}

      {/* Help section */}
      <div className="hive-card p-5">
        <h3 className="text-sm font-semibold text-ink-primary mb-3">How rules work</h3>
        <div className="space-y-2 text-xs text-ink-tertiary">
          <p>• Rules are checked before AI categorization. The first matching rule wins.</p>
          <p>• <strong className="text-ink-secondary">Priority</strong>: lower number = higher priority. Use 1–50 for your most specific rules.</p>
          <p>• <strong className="text-ink-secondary">Contains</strong>: case-insensitive substring match on the raw transaction description.</p>
          <p>• <strong className="text-ink-secondary">Regex</strong>: full Python regex. Use <code className="bg-white/[0.06] px-1 py-0.5 rounded">(?i)</code> for case-insensitive.</p>
          <p>• <strong className="text-ink-secondary">Amount range</strong>: matches based on transaction dollar amount, useful for utility bills.</p>
          <p>• After creating or editing rules, click <strong className="text-ink-secondary">"Apply rules now"</strong> to re-categorize existing transactions.</p>
        </div>
      </div>
    </div>
  );
}
