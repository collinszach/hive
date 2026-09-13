"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Plane, MapPin, ArrowRight, Trash2 } from "lucide-react";
import { api, Trip, TravelBalances } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import { toast } from "@/components/Toast";

const STATUS_LABEL: Record<Trip["status"], string> = {
  dreaming: "Dreaming",
  planning: "Planning",
  booked: "Booked",
  taken: "Taken",
};

const STATUS_STYLE: Record<Trip["status"], string> = {
  dreaming: "bg-white/[0.06] text-ink-tertiary",
  planning: "bg-honey/15 text-honey",
  booked: "bg-semantic-income/15 text-semantic-income",
  taken: "bg-white/[0.04] text-ink-ghost",
};

export default function TravelPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [balances, setBalances] = useState<TravelBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");

  async function load() {
    setLoading(true);
    const [t, b] = await Promise.allSettled([api.travel.trips(), api.travel.balances()]);
    if (t.status === "fulfilled") setTrips(t.value);
    if (b.status === "fulfilled") setBalances(b.value);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createTrip() {
    if (!name.trim()) return;
    try {
      const trip = await api.travel.createTrip({
        name: name.trim(),
        destination: destination.trim() || null,
      });
      setTrips((prev) => [trip, ...prev]);
      setName(""); setDestination(""); setAdding(false);
      toast.success("Trip created");
    } catch { toast.error("Failed to create trip"); }
  }

  async function removeTrip(id: string) {
    try {
      await api.travel.deleteTrip(id);
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Travel</h1>
          <p className="text-[13px] text-ink-tertiary mt-1">
            Cash or points, on which card — ranked against what a point is worth to you.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-honey text-black hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> New trip
        </button>
      </div>

      {adding && (
        <div className="hive-card p-4 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTrip()}
            placeholder="Trip name"
            autoFocus
            className="flex-1 min-w-[180px] text-[13px] bg-white/[0.06] border border-white/[0.12] rounded px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-honey/40"
          />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTrip()}
            placeholder="Destination (optional)"
            className="flex-1 min-w-[160px] text-[13px] bg-white/[0.06] border border-white/[0.12] rounded px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-honey/40"
          />
          <button onClick={createTrip} className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-honey text-black hover:opacity-90">
            Create
          </button>
        </div>
      )}

      {/* What you have to spend */}
      {balances && balances.programs.length > 0 && (
        <div className="hive-card p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-ink-primary">What you have to spend</p>
            <p className="text-[10px] text-ink-ghost">
              transfer data verified {balances.partners_verified_on}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {balances.programs.map((p) => (
              <div key={p.program} className="rounded-lg bg-white/[0.03] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-ink-primary">{p.program}</span>
                  <span className="text-[12px] font-mono text-ink-secondary tabular-nums">
                    {Math.round(p.balance).toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-ink-tertiary mt-1">
                  {p.transferable
                    ? `${p.partner_count} transfer partners`
                    : "No transfer partners"}
                </p>
                {p.advice && !p.transferable && (
                  <p className="text-[10px] text-honey mt-1.5 leading-snug">{p.advice}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="hive-card h-20 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!loading && trips.length === 0 && (
        <div className="hive-card flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-surface border border-border-subtle flex items-center justify-center mb-4">
            <Plane className="h-6 w-6 text-honey" />
          </div>
          <h3 className="text-base font-semibold text-ink-primary mb-2">No trips yet</h3>
          <p className="text-sm text-ink-tertiary max-w-sm leading-relaxed">
            Start one for somewhere you&apos;re thinking about. Add the flights and hotels,
            then paste in quotes — cash, award, Costco — and see which actually costs least
            once the points are priced at what they&apos;re worth to you.
          </p>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div className="space-y-2">
          {trips.map((t) => (
            <div key={t.id} className="hive-card p-4 flex items-center gap-4 group">
              <Link href={`/travel/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-ink-primary">{t.name}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", STATUS_STYLE[t.status])}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-tertiary">
                  {t.destination && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {t.destination}
                    </span>
                  )}
                  <span>{t.leg_count} {t.leg_count === 1 ? "leg" : "legs"}</span>
                  {t.estimated_true_cost !== null && (
                    <span className="font-mono">≈ {fmt(t.estimated_true_cost)}</span>
                  )}
                </div>
              </Link>
              <button
                onClick={() => removeTrip(t.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-ghost hover:text-semantic-expense transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <Link href={`/travel/${t.id}`} className="text-ink-ghost hover:text-ink-secondary">
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
