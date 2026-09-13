"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check, AlertTriangle, Plane, Hotel, Car, Ticket } from "lucide-react";
import { api, TripDetail, TripLeg, TravelOption, PointsRoute } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import { toast } from "@/components/Toast";

const KIND_ICON = { flight: Plane, hotel: Hotel, car: Car, activity: Ticket } as const;

const RATING_STYLE: Record<TravelOption["rating"], string> = {
  great: "text-semantic-income",
  good: "text-semantic-income/80",
  fair: "text-ink-secondary",
  poor: "text-semantic-expense",
  unknown: "text-ink-ghost",
};

export default function TripBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingLeg, setAddingLeg] = useState(false);
  const [legKind, setLegKind] = useState<TripLeg["kind"]>("flight");
  const [legTitle, setLegTitle] = useState("");
  const [optionFor, setOptionFor] = useState<string | null>(null);
  const [routesFor, setRoutesFor] = useState<{ option: TravelOption; routes: PointsRoute[] } | null>(null);

  const load = useCallback(async () => {
    try {
      setTrip(await api.travel.trip(id));
    } catch {
      toast.error("Failed to load trip");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addLeg() {
    try {
      await api.travel.addLeg(id, { kind: legKind, title: legTitle.trim() || null });
      setLegTitle(""); setAddingLeg(false);
      load();
    } catch { toast.error("Failed to add leg"); }
  }

  async function selectOption(optionId: string) {
    try {
      await api.travel.selectOption(optionId);
      load();
    } catch { toast.error("Failed to select"); }
  }

  async function removeOption(optionId: string) {
    try {
      await api.travel.deleteOption(optionId);
      load();
    } catch { toast.error("Failed to remove"); }
  }

  async function showRoutes(o: TravelOption) {
    if (!o.program || !o.points_price) return;
    try {
      const routes = await api.travel.routes(o.program, o.points_price);
      setRoutesFor({ option: o, routes });
    } catch { toast.error("Failed to load routes"); }
  }

  if (loading) return <div className="hive-card h-64 animate-pulse bg-white/[0.02]" />;
  if (!trip) return <div className="hive-card p-10 text-center text-ink-tertiary text-[13px]">Trip not found.</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Link href="/travel" className="mt-1 text-ink-ghost hover:text-ink-secondary">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-ink-primary">{trip.name}</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">
            {trip.destination ?? "No destination set"}
            {trip.estimated_true_cost !== null && (
              <> · ≈ <span className="font-mono">{fmt(trip.estimated_true_cost)}</span> all-in</>
            )}
          </p>
        </div>
        <button
          onClick={() => setAddingLeg((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-honey text-black hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Add leg
        </button>
      </div>

      {addingLeg && (
        <div className="hive-card p-4 flex flex-wrap items-center gap-2">
          <select
            value={legKind}
            onChange={(e) => setLegKind(e.target.value as TripLeg["kind"])}
            className="text-[12px] bg-white/[0.06] border border-white/[0.12] rounded px-2 py-1.5 text-ink-primary focus:outline-none"
          >
            <option value="flight">Flight</option>
            <option value="hotel">Hotel</option>
            <option value="car">Car</option>
            <option value="activity">Activity</option>
          </select>
          <input
            value={legTitle}
            onChange={(e) => setLegTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLeg()}
            placeholder="e.g. LAX → LIS, Mar 14"
            autoFocus
            className="flex-1 min-w-[200px] text-[13px] bg-white/[0.06] border border-white/[0.12] rounded px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-honey/40"
          />
          <button onClick={addLeg} className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-honey text-black hover:opacity-90">
            Add
          </button>
        </div>
      )}

      {trip.legs.length === 0 && !addingLeg && (
        <div className="hive-card p-10 text-center">
          <p className="text-[13px] text-ink-tertiary">
            Add a flight or hotel, then paste in the quotes you&apos;re weighing up.
          </p>
        </div>
      )}

      {trip.legs.map((leg) => {
        const Icon = KIND_ICON[leg.kind] ?? Ticket;
        return (
          <div key={leg.id} className="hive-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-honey" />
              <p className="text-[14px] font-medium text-ink-primary">
                {leg.title ?? leg.kind[0].toUpperCase() + leg.kind.slice(1)}
              </p>
              <button
                onClick={() => setOptionFor(optionFor === leg.id ? null : leg.id)}
                className="ml-auto text-[11px] text-honey hover:opacity-80"
              >
                + Add option
              </button>
            </div>

            {optionFor === leg.id && (
              <OptionForm legId={leg.id} onSaved={() => { setOptionFor(null); load(); }} />
            )}

            {leg.options.length === 0 ? (
              <p className="text-[12px] text-ink-tertiary">
                No quotes yet. Add a cash price and an award to compare them.
              </p>
            ) : (
              <div className="space-y-1.5">
                {leg.options.map((o) => (
                  <div
                    key={o.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg group",
                      o.is_selected ? "bg-honey/10 border border-honey/30"
                        : o.is_best ? "bg-semantic-income/[0.06] border border-semantic-income/20"
                        : "bg-white/[0.03] border border-transparent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-ink-primary truncate">
                          {o.label ?? (o.points_price ? o.program : "Cash")}
                        </span>
                        {o.is_best && !o.is_selected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-semantic-income/20 text-semantic-income">
                            BEST
                          </span>
                        )}
                        {o.is_selected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-honey/20 text-honey">
                            CHOSEN
                          </span>
                        )}
                      </div>
                      <p className={cn("text-[11px] mt-0.5", RATING_STYLE[o.rating])}>
                        {o.verdict}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-mono text-ink-primary tabular-nums">
                        {o.points_price
                          ? `${Math.round(o.points_price).toLocaleString()} pts${o.fees ? ` + ${fmt(o.fees)}` : ""}`
                          : o.cash_price !== null ? fmt(o.cash_price) : "—"}
                      </p>
                      {o.true_cost !== null && (
                        <p className="text-[10px] text-ink-tertiary font-mono">
                          ≈ {fmt(o.true_cost)} all-in
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {o.points_price && o.program && (
                        <button
                          onClick={() => showRoutes(o)}
                          title="How could I pay for this?"
                          className="text-[10px] text-ink-ghost hover:text-honey px-1.5"
                        >
                          routes
                        </button>
                      )}
                      <button
                        onClick={() => selectOption(o.id)}
                        title="Choose this option"
                        className="p-1 rounded text-ink-ghost hover:text-semantic-income"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeOption(o.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-ghost hover:text-semantic-expense transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {routesFor && (
        <RoutesModal
          option={routesFor.option}
          routes={routesFor.routes}
          onClose={() => setRoutesFor(null)}
        />
      )}
    </div>
  );
}

/** Paste in a quote — cash, award, Costco, a portal. Manual by design: none of those
 *  sources has a public API, and the comparison is the product, not the scraping. */
function OptionForm({ legId, onSaved }: { legId: string; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [cash, setCash] = useState("");
  const [points, setPoints] = useState("");
  const [program, setProgram] = useState("");
  const [fees, setFees] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!cash && !points) { toast.error("Give a cash price, points, or both"); return; }
    if (points && !program) { toast.error("A points price needs a program"); return; }
    setSaving(true);
    try {
      await api.travel.addOption(legId, {
        label: label.trim() || null,
        cash_price: cash ? parseFloat(cash) : null,
        points_price: points ? parseFloat(points) : null,
        program: program.trim() || null,
        fees: fees ? parseFloat(fees) : 0,
        source: points ? "manual_award" : "manual_cash",
        quoted_on: new Date().toISOString().slice(0, 10),
      });
      onSaved();
    } catch { toast.error("Failed to add option"); }
    finally { setSaving(false); }
  }

  const input = "text-[12px] bg-white/[0.06] border border-white/[0.12] rounded px-2 py-1.5 text-ink-primary focus:outline-none focus:border-honey/40";

  return (
    <div className="rounded-lg bg-white/[0.03] p-3 flex flex-wrap items-center gap-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)}
             placeholder="Label (e.g. Aeroplan, Costco)" className={cn(input, "flex-1 min-w-[150px]")} />
      <input value={cash} onChange={(e) => setCash(e.target.value)}
             placeholder="cash $" inputMode="decimal" className={cn(input, "w-24")} />
      <input value={points} onChange={(e) => setPoints(e.target.value)}
             placeholder="points" inputMode="numeric" className={cn(input, "w-24")} />
      <input value={program} onChange={(e) => setProgram(e.target.value)}
             placeholder="program" className={cn(input, "w-36")} />
      <input value={fees} onChange={(e) => setFees(e.target.value)}
             placeholder="fees $" inputMode="decimal" className={cn(input, "w-20")} />
      <button onClick={save} disabled={saving}
              className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-honey text-black hover:opacity-90 disabled:opacity-40">
        {saving ? "…" : "Add"}
      </button>
    </div>
  );
}

/** Where the points would come from — direct balances first, then transfers. */
function RoutesModal({ option, routes, onClose }: {
  option: TravelOption; routes: PointsRoute[]; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto hive-card p-5 space-y-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-primary">How could I pay for this?</h2>
          <p className="text-[12px] text-ink-tertiary mt-0.5">
            {Math.round(option.points_price ?? 0).toLocaleString()} {option.program}
          </p>
        </div>

        {routes.length === 0 && (
          <p className="text-[12px] text-ink-tertiary">
            None of your balances reach {option.program}.
          </p>
        )}

        {routes.map((r, i) => (
          <div key={`${r.program}-${i}`} className={cn(
            "rounded-lg p-3",
            r.covered ? "bg-semantic-income/[0.06] border border-semantic-income/20" : "bg-white/[0.03]"
          )}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-ink-primary">
                {r.program}
                {!r.direct && r.partner && (
                  <span className="text-ink-tertiary"> → {r.partner}</span>
                )}
              </span>
              <span className="text-[12px] font-mono text-ink-secondary tabular-nums">
                {Math.round(r.needed).toLocaleString()} needed
              </span>
            </div>
            <p className="text-[11px] text-ink-tertiary mt-0.5">
              You have {Math.round(r.available).toLocaleString()}
              {r.covered
                ? " — covered."
                : ` — ${Math.round(r.shortfall).toLocaleString()} short.`}
              {r.ratio !== 1 && ` Ratio ${r.ratio}:1.`}
            </p>
            {!r.direct && r.warning && (
              <p className="flex items-start gap-1.5 text-[10px] text-honey mt-1.5 leading-snug">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                {r.warning}
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-ink-tertiary hover:text-ink-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
