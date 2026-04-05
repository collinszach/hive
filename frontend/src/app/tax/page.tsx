"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, TaxDocument, TaxCalculationResult, TaxCalculateRequest } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, ChevronLeft, Trash2, RefreshCw, Lightbulb,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "W2",      label: "W-2",       desc: "Employee wages & withholding" },
  { value: "1099NEC", label: "1099-NEC",  desc: "Freelance / self-employment income" },
  { value: "1099DIV", label: "1099-DIV",  desc: "Dividends & capital gain distributions" },
  { value: "1099INT", label: "1099-INT",  desc: "Interest income" },
  { value: "1099B",   label: "1099-B",    desc: "Stock / investment sales" },
  { value: "1099G",   label: "1099-G",    desc: "Unemployment compensation" },
] as const;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

const FILING_STATUSES = [
  { value: "single", label: "Single" },
  { value: "mfj",    label: "Married Filing Jointly" },
  { value: "mfs",    label: "Married Filing Separately" },
  { value: "hoh",    label: "Head of Household" },
];

type Step = 1 | 2 | 3 | 4;

// ── Step 1: Upload ─────────────────────────────────────────────────────────────

function UploadStep({
  docs,
  taxYear,
  onDocsChange,
  onNext,
}: {
  docs: TaxDocument[];
  taxYear: number;
  onDocsChange: () => void;
  onNext: () => void;
}) {
  const [uploading, setUploading]   = useState(false);
  const [selectedType, setSelectedType] = useState("W2");
  const [dragOver, setDragOver]     = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await api.tax.uploadDocument(f, selectedType, taxYear);
      }
      onDocsChange();
    } finally {
      setUploading(false);
    }
  }

  async function handleExtract(id: string) {
    setExtractingId(id);
    try {
      await api.tax.extractDocument(id);
      onDocsChange();
    } finally {
      setExtractingId(null);
    }
  }

  async function handleDelete(id: string) {
    await api.tax.deleteDocument(id);
    onDocsChange();
  }

  const allExtracted = docs.length > 0 && docs.every(d => d.extraction_status === "done");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold text-ink-primary mb-1">Upload Tax Documents</p>
        <p className="text-[12px] text-ink-tertiary">
          Upload your W-2s and 1099s for tax year {taxYear}. We&apos;ll use AI to extract the values.
        </p>
      </div>

      {/* Doc type selector */}
      <div className="grid grid-cols-3 gap-2">
        {DOC_TYPES.map(dt => (
          <button
            key={dt.value}
            onClick={() => setSelectedType(dt.value)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              selectedType === dt.value
                ? "border-honey/40 bg-honey/[0.06] text-ink-primary"
                : "border-white/[0.06] bg-white/[0.02] text-ink-tertiary hover:border-white/[0.12]"
            )}
          >
            <p className="text-[12px] font-semibold">{dt.label}</p>
            <p className="text-[10px] mt-0.5 opacity-70">{dt.desc}</p>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
          dragOver
            ? "border-honey/60 bg-honey/[0.04]"
            : "border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.02]"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-ink-tertiary">
            <Loader2 className="w-6 h-6 animate-spin text-honey" />
            <p className="text-[13px]">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-ink-tertiary/40" />
            <p className="text-[13px] font-medium text-ink-secondary">
              Drop {selectedType} here, or click to browse
            </p>
            <p className="text-[11px] text-ink-tertiary">PDF, JPG, or PNG</p>
          </div>
        )}
      </div>

      {/* Uploaded docs */}
      {docs.length > 0 && (
        <div className="hive-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-[12px] font-medium text-ink-primary">{docs.length} documents uploaded</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-3">
                <FileText className="w-4 h-4 text-ink-tertiary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-ink-primary truncate">{doc.filename}</p>
                  <p className="text-[10px] text-ink-tertiary">{doc.doc_type} · {doc.tax_year}</p>
                </div>

                {/* Status badge */}
                {doc.extraction_status === "done" && (
                  <span className="flex items-center gap-1 text-[10px] text-semantic-income shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Extracted
                  </span>
                )}
                {doc.extraction_status === "failed" && (
                  <span className="flex items-center gap-1 text-[10px] text-semantic-expense shrink-0">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                )}
                {doc.extraction_status === "pending" && (
                  <button
                    onClick={() => handleExtract(doc.id)}
                    disabled={extractingId === doc.id}
                    className="text-[10px] px-2 py-1 rounded-lg bg-honey/10 text-honey hover:bg-honey/20 transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1"
                  >
                    {extractingId === doc.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Extracting…</>
                    ) : (
                      <><RefreshCw className="w-3 h-3" /> Extract</>
                    )}
                  </button>
                )}
                {doc.extraction_status === "processing" && (
                  <span className="text-[10px] text-ink-tertiary flex items-center gap-1 shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin" /> Processing…
                  </span>
                )}

                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-ink-tertiary/50 hover:text-semantic-expense transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={docs.length === 0}
          className="flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
        >
          Review Extracted Data <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Review ─────────────────────────────────────────────────────────────

function ReviewStep({
  docs,
  onDocsChange,
  onNext,
  onBack,
}: {
  docs: TaxDocument[];
  onDocsChange: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [editMap, setEditMap] = useState<Record<string, Record<string, unknown>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function getVal(doc: TaxDocument, key: string): string {
    const override = editMap[doc.id]?.[key];
    if (override !== undefined) return String(override);
    return String((doc.extracted_json as Record<string, unknown>)?.[key] ?? "");
  }

  function setVal(docId: string, key: string, val: string) {
    setEditMap(prev => ({
      ...prev,
      [docId]: { ...prev[docId], [key]: isNaN(Number(val)) ? val : Number(val) },
    }));
  }

  async function handleSave(doc: TaxDocument) {
    setSaving(doc.id);
    const merged = { ...(doc.extracted_json ?? {}), ...(editMap[doc.id] ?? {}) };
    try {
      await api.tax.updateDocument(doc.id, merged);
      onDocsChange();
    } finally {
      setSaving(null);
    }
  }

  const FIELD_LABELS: Record<string, Record<string, string>> = {
    W2: { box1_wages: "Box 1 — Wages", box2_federal_withheld: "Box 2 — Fed Withheld", box16_state_wages: "Box 16 — State Wages", box17_state_withheld: "Box 17 — State Withheld" },
    "1099NEC": { box1_nonemployee_comp: "Box 1 — Nonemployee Comp", box4_federal_withheld: "Box 4 — Fed Withheld" },
    "1099DIV": { box1a_ordinary_dividends: "Box 1a — Ordinary Dividends", box1b_qualified_dividends: "Box 1b — Qualified Dividends", box2a_total_capital_gain: "Box 2a — Capital Gain Distrib.", box4_federal_withheld: "Box 4 — Fed Withheld" },
    "1099INT": { box1_interest_income: "Box 1 — Interest Income", box4_federal_withheld: "Box 4 — Fed Withheld", box8_tax_exempt_interest: "Box 8 — Tax-Exempt Interest" },
    "1099G": { box1_unemployment_comp: "Box 1 — Unemployment Comp", box4_federal_withheld: "Box 4 — Fed Withheld" },
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold text-ink-primary mb-1">Review Extracted Values</p>
        <p className="text-[12px] text-ink-tertiary">Verify the values Claude extracted. Edit any that look wrong.</p>
      </div>

      {docs.filter(d => d.doc_type !== "1099B").map(doc => {
        const fields = FIELD_LABELS[doc.doc_type] ?? {};
        return (
          <div key={doc.id} className="hive-card overflow-hidden">
            <div className="hive-section-header">
              <div>
                <p className="text-[13px] font-medium text-ink-primary">{doc.doc_type} — {doc.filename}</p>
                {doc.extraction_status !== "done" && (
                  <p className="text-[11px] text-semantic-expense mt-0.5">Not yet extracted — values may be missing</p>
                )}
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {Object.entries(fields).map(([key, label]) => (
                <div key={key}>
                  <label className="hive-label block mb-1">{label}</label>
                  <input
                    type="number"
                    value={getVal(doc, key)}
                    onChange={e => setVal(doc.id, key, e.target.value)}
                    className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary focus:outline-none focus:border-honey/30 font-mono"
                  />
                </div>
              ))}
            </div>
            {editMap[doc.id] && Object.keys(editMap[doc.id]).length > 0 && (
              <div className="px-5 pb-4">
                <button
                  onClick={() => handleSave(doc)}
                  disabled={saving === doc.id}
                  className="text-[12px] px-4 py-2 rounded-lg bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40"
                >
                  {saving === doc.id ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 1099-B docs are shown as a summary since they have multiple entries */}
      {docs.filter(d => d.doc_type === "1099B").map(doc => {
        const entries = (doc.extracted_json as Record<string, unknown[]>)?.entries ?? [];
        const totalProceeds = (entries as Record<string, number>[]).reduce((s, e) => s + (e.proceeds ?? 0), 0);
        const totalBasis = (entries as Record<string, number>[]).reduce((s, e) => s + (e.cost_basis ?? 0), 0);
        return (
          <div key={doc.id} className="hive-card p-5">
            <p className="text-[13px] font-medium text-ink-primary mb-2">1099-B — {doc.filename}</p>
            <p className="text-[12px] text-ink-tertiary">
              {entries.length} transactions · Proceeds: {fmt(totalProceeds)} · Basis: {fmt(totalBasis)} · Net: {fmt(totalProceeds - totalBasis)}
            </p>
          </div>
        );
      })}

      <div className="flex justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors font-medium"
        >
          Filing Information <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Filing Info ────────────────────────────────────────────────────────

function FilingInfoStep({
  req,
  onReqChange,
  onNext,
  onBack,
  calculating,
}: {
  req: TaxCalculateRequest;
  onReqChange: (r: TaxCalculateRequest) => void;
  onNext: () => void;
  onBack: () => void;
  calculating: boolean;
}) {
  function set<K extends keyof TaxCalculateRequest>(key: K, val: TaxCalculateRequest[K]) {
    onReqChange({ ...req, [key]: val });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold text-ink-primary mb-1">Filing Information</p>
        <p className="text-[12px] text-ink-tertiary">Tell us about your filing situation for accurate calculations.</p>
      </div>

      <div className="hive-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="hive-label block mb-1.5">Tax Year</label>
            <select
              value={req.tax_year}
              onChange={e => set("tax_year", Number(e.target.value))}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
            >
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>
          <div>
            <label className="hive-label block mb-1.5">Filing Status</label>
            <select
              value={req.filing_status}
              onChange={e => set("filing_status", e.target.value)}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
            >
              {FILING_STATUSES.map(fs => <option key={fs.value} value={fs.value}>{fs.label}</option>)}
            </select>
          </div>
          <div>
            <label className="hive-label block mb-1.5">State of Residence</label>
            <select
              value={req.state}
              onChange={e => set("state", e.target.value)}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
            >
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="hive-label block mb-1.5">Qualifying Dependents</label>
            <input
              type="number"
              min={0}
              value={req.dependents}
              onChange={e => set("dependents", Number(e.target.value))}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary font-mono"
            />
          </div>
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <p className="text-[12px] font-medium text-ink-primary mb-3">Deductions & Credits (optional)</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "mortgage_interest" as const, label: "Mortgage Interest" },
              { key: "state_local_taxes_paid" as const, label: "State/Local Taxes Paid (capped at $10k)" },
              { key: "se_health_insurance" as const, label: "SE Health Insurance Premiums" },
              { key: "student_loan_interest" as const, label: "Student Loan Interest" },
              { key: "child_dependent_care_credit" as const, label: "Child/Dependent Care Credit" },
              { key: "education_credits" as const, label: "Education Credits" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="hive-label block mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={req[key] as number}
                  onChange={e => set(key, Number(e.target.value))}
                  className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary font-mono"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={req.pull_transactions}
              onChange={e => set("pull_transactions", e.target.checked)}
              className="accent-honey w-4 h-4"
            />
            <div>
              <p className="text-[13px] text-ink-primary">Pull deductible expenses from transactions</p>
              <p className="text-[11px] text-ink-tertiary">Auto-adds charitable contributions from your transaction data</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={calculating}
          className="flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
        >
          {calculating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Calculating…</>
          ) : (
            <>Calculate Taxes <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Results ────────────────────────────────────────────────────────────

function ResultsStep({
  result,
  onBack,
}: {
  result: TaxCalculationResult;
  onBack: () => void;
}) {
  const { federal: f, state: s } = result;
  const isRefund = result.combined_owed <= 0;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Federal",
            value: f.federal_owed > 0 ? `Owe ${fmt(f.federal_owed)}` : `Refund ${fmt(f.federal_refund)}`,
            color: f.federal_owed > 0 ? "text-semantic-expense" : "text-semantic-income",
          },
          {
            label: `${s.state} State`,
            value: s.state_owed > 0 ? `Owe ${fmt(s.state_owed)}` : `Refund ${fmt(s.state_refund)}`,
            color: s.state_owed > 0 ? "text-semantic-expense" : "text-semantic-income",
          },
          { label: "Effective Rate", value: `${f.effective_rate_pct}%`, color: "text-ink-primary" },
          { label: "Marginal Rate", value: `${f.marginal_rate_pct}%`, color: "text-ink-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="hive-card p-4">
            <p className="hive-label mb-2">{label}</p>
            <p className={cn("text-[16px] font-bold font-mono tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Combined total */}
      <div className={cn(
        "hive-card p-5 flex items-center justify-between",
        isRefund ? "bg-semantic-income/[0.04] border border-semantic-income/[0.12]" : ""
      )}>
        <div>
          <p className="text-[13px] font-medium text-ink-primary">Combined Total</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">Federal + {s.state} state</p>
        </div>
        <p className={cn(
          "text-[28px] font-bold font-mono tabular-nums",
          isRefund ? "text-semantic-income" : "text-semantic-expense"
        )}>
          {isRefund ? `+${fmt(-result.combined_owed)}` : fmt(result.combined_owed)}
        </p>
      </div>

      {/* Key insights */}
      {result.insights.length > 0 && (
        <div className="hive-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-honey" />
            <p className="text-[13px] font-medium text-ink-primary">Key Insights</p>
          </div>
          <ul className="space-y-2">
            {result.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-ink-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-honey mt-1.5 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quarterly payments */}
      {f.quarterly_estimated_payment > 0 && (
        <div className="hive-card p-5">
          <p className="text-[13px] font-medium text-ink-primary mb-3">Estimated Quarterly Payments (Next Year)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Q1", due: "Apr 15" },
              { label: "Q2", due: "Jun 15" },
              { label: "Q3", due: "Sep 15" },
              { label: "Q4", due: "Jan 15" },
            ].map(({ label, due }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[10px] text-ink-tertiary">{label} · Due {due}</p>
                <p className="text-[16px] font-mono font-bold text-honey mt-1 tabular-nums">
                  {fmt(f.quarterly_estimated_payment)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Income breakdown accordion */}
      <details className="hive-card overflow-hidden">
        <summary className="px-5 py-4 cursor-pointer text-[13px] font-medium text-ink-primary hover:bg-white/[0.02] transition-colors list-none flex items-center justify-between">
          Income Breakdown
          <ChevronRight className="w-4 h-4 text-ink-tertiary transition-transform [[open]>summary>&]:rotate-90" />
        </summary>
        <div className="px-5 pb-4 space-y-2 border-t border-white/[0.04]">
          {[
            { label: "W-2 Wages", value: f.w2_wages },
            { label: "Self-Employment (1099-NEC)", value: f.se_income },
            { label: "Ordinary Dividends", value: f.ordinary_dividends },
            { label: "Taxable Interest", value: f.taxable_interest },
            { label: "Short-Term Capital Gains", value: f.st_capital_gains },
            { label: "Long-Term Capital Gains", value: f.lt_capital_gains },
            { label: "Unemployment Compensation", value: f.unemployment_comp },
          ].filter(r => r.value !== 0).map(({ label, value }) => (
            <div key={label} className="flex justify-between text-[12px]">
              <span className="text-ink-tertiary">{label}</span>
              <span className="text-ink-primary font-mono tabular-nums">{fmt(value)}</span>
            </div>
          ))}
          <div className="flex justify-between text-[13px] font-semibold pt-2 border-t border-white/[0.05]">
            <span className="text-ink-primary">Gross Income</span>
            <span className="text-ink-primary font-mono tabular-nums">{fmt(f.gross_income)}</span>
          </div>
          <div className="flex justify-between text-[13px] font-semibold">
            <span className="text-ink-primary">AGI</span>
            <span className="text-ink-primary font-mono tabular-nums">{fmt(f.agi)}</span>
          </div>
        </div>
      </details>

      {/* Deductions breakdown */}
      <details className="hive-card overflow-hidden">
        <summary className="px-5 py-4 cursor-pointer text-[13px] font-medium text-ink-primary hover:bg-white/[0.02] transition-colors list-none flex items-center justify-between">
          Deductions Used: {f.used_standard_deduction ? "Standard" : "Itemized"} (${f.deduction_used.toLocaleString()})
          <ChevronRight className="w-4 h-4 text-ink-tertiary" />
        </summary>
        <div className="px-5 pb-4 space-y-2 border-t border-white/[0.04]">
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-tertiary">Standard Deduction</span>
            <span className={cn("font-mono tabular-nums", f.used_standard_deduction ? "text-honey font-semibold" : "text-ink-tertiary")}>{fmt(f.standard_deduction)}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-tertiary">Itemized Deduction</span>
            <span className={cn("font-mono tabular-nums", !f.used_standard_deduction ? "text-honey font-semibold" : "text-ink-tertiary")}>{fmt(f.itemized_deduction)}</span>
          </div>
          {f.qbi_deduction > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-ink-tertiary">QBI Deduction (20% of SE)</span>
              <span className="text-ink-tertiary font-mono tabular-nums">{fmt(f.qbi_deduction)}</span>
            </div>
          )}
          {f.half_se_deduction > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-ink-tertiary">½ SE Tax Deduction</span>
              <span className="text-ink-tertiary font-mono tabular-nums">{fmt(f.half_se_deduction)}</span>
            </div>
          )}
        </div>
      </details>

      <div className="flex justify-start">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Filing Info
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_REQUEST: TaxCalculateRequest = {
  tax_year: 2024,
  filing_status: "single",
  dependents: 0,
  state: "TX",
  pull_transactions: false,
  mortgage_interest: 0,
  state_local_taxes_paid: 0,
  se_health_insurance: 0,
  student_loan_interest: 0,
  child_dependent_care_credit: 0,
  education_credits: 0,
};

export default function TaxPage() {
  const [step, setStep]             = useState<Step>(1);
  const [taxYear, setTaxYear]       = useState(2024);
  const [docs, setDocs]             = useState<TaxDocument[]>([]);
  const [req, setReq]               = useState<TaxCalculateRequest>(DEFAULT_REQUEST);
  const [result, setResult]         = useState<TaxCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const loadDocs = useCallback(() => {
    api.tax.listDocuments(taxYear).then(setDocs);
  }, [taxYear]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleCalculate() {
    setCalculating(true);
    try {
      const r = await api.tax.calculate({ ...req, tax_year: taxYear });
      setResult(r);
      setStep(4);
    } catch (e) {
      console.error(e);
    } finally {
      setCalculating(false);
    }
  }

  const STEPS = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Review" },
    { n: 3, label: "Filing Info" },
    { n: 4, label: "Results" },
  ];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Tax Calculator</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">Federal + state tax calculation from your documents</p>
        </div>
        <select
          value={taxYear}
          onChange={e => setTaxYear(Number(e.target.value))}
          className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
        >
          <option value={2024}>2024 Tax Year</option>
          <option value={2023}>2023 Tax Year</option>
        </select>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all",
              step === s.n ? "bg-honey text-black" :
              step > s.n ? "bg-semantic-income text-black" :
              "bg-white/[0.06] text-ink-tertiary"
            )}>
              {step > s.n ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span className={cn(
              "text-[11px] font-medium",
              step === s.n ? "text-honey" : step > s.n ? "text-ink-secondary" : "text-ink-tertiary"
            )}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-ink-tertiary/40" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 1 && <UploadStep docs={docs} taxYear={taxYear} onDocsChange={loadDocs} onNext={() => setStep(2)} />}
      {step === 2 && <ReviewStep docs={docs} onDocsChange={loadDocs} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && (
        <FilingInfoStep
          req={req}
          onReqChange={setReq}
          onNext={handleCalculate}
          onBack={() => setStep(2)}
          calculating={calculating}
        />
      )}
      {step === 4 && result && <ResultsStep result={result} onBack={() => setStep(3)} />}
    </div>
  );
}
