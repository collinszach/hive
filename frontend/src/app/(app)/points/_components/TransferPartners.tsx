"use client";

import { useState } from "react";
import { ExternalLink, Plane, Hotel, Info } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

interface TransferPartner {
  airline: string;
  program: string;
  type: "airline" | "hotel";
  ratio: string;           // "1:1", "1:2", etc.
  ratioNum: number;        // points you get per 1 source point (for sorting)
  cpp: number;             // estimated cents per point at this partner
  sweetSpot?: string;
  bestFor?: string;
}

interface ProgramData {
  program: string;
  slug: string;
  color: string;
  partners: TransferPartner[];
  sourceCpp: number;       // base value of the source currency in cpp
  notes?: string;
}

const PROGRAMS: ProgramData[] = [
  {
    program: "Amex Membership Rewards",
    slug: "amex_mr",
    color: "#006FCF",
    sourceCpp: 2.0,
    notes: "Best transferred to Air France/KLM Flying Blue or Avianca LifeMiles for partner redemptions.",
    partners: [
      { airline: "Air France / KLM", program: "Flying Blue", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Partner awards to Europe", bestFor: "Europe business class" },
      { airline: "ANA", program: "ANA Mileage Club", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 2.8, sweetSpot: "Round-trips to Japan from 55k", bestFor: "Japan in business" },
      { airline: "British Airways", program: "Avios", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Short-haul US on American", bestFor: "Short domestic hops" },
      { airline: "Cathay Pacific", program: "Asia Miles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Business to Asia from 70k", bestFor: "Asia premium cabin" },
      { airline: "Delta", program: "SkyMiles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.2, sweetSpot: "Variable — watch flash sales", bestFor: "Delta partner awards" },
      { airline: "Emirates", program: "Skywards", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.3, sweetSpot: "First class with in-flight bar", bestFor: "Emirates first class" },
      { airline: "Etihad", program: "Guest Miles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.6, sweetSpot: "The Residence if you can get it", bestFor: "Luxury first class" },
      { airline: "Hawaiian", program: "HawaiianMiles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 0.9, sweetSpot: "Hawaii inter-island", bestFor: "Hawaii flights" },
      { airline: "Iberia", program: "Iberia Plus", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.4, sweetSpot: "Europe and Latin America", bestFor: "Spain / LatAm routes" },
      { airline: "Qantas", program: "Qantas Points", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.2, sweetSpot: "Partner awards to/from Australia", bestFor: "Australia routes" },
      { airline: "Singapore", program: "KrisFlyer", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.9, sweetSpot: "Saver awards to Asia", bestFor: "Asia first class" },
      { airline: "Virgin Atlantic", program: "Flying Club", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Delta premium cabin via partner", bestFor: "Delta One bookings" },
      { airline: "Hilton", program: "Hilton Honors", type: "hotel", ratio: "1:2", ratioNum: 2, cpp: 0.6, sweetSpot: "Limited value — avoid if possible", bestFor: "Hilton properties" },
      { airline: "Marriott Bonvoy", program: "Marriott Bonvoy", type: "hotel", ratio: "1:1", ratioNum: 1, cpp: 0.7, sweetSpot: "Category 1-4 properties", bestFor: "Marriott mid-tier" },
    ],
  },
  {
    program: "Chase Ultimate Rewards",
    slug: "chase_ur",
    color: "#117ACA",
    sourceCpp: 2.05,
    notes: "World of Hyatt is consistently the best transfer partner — 5 star hotels for 25–30k points.",
    partners: [
      { airline: "Air France / KLM", program: "Flying Blue", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Promo awards & partner routes", bestFor: "Europe business" },
      { airline: "Air Canada", program: "Aeroplan", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 2.0, sweetSpot: "Partner Star Alliance saver awards", bestFor: "Star Alliance in J/F" },
      { airline: "British Airways", program: "Avios", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Short-haul American routes", bestFor: "Short hops on AA" },
      { airline: "Emirates", program: "Skywards", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.3, sweetSpot: "Emirates first class", bestFor: "Emirates premium" },
      { airline: "Iberia", program: "Iberia Plus", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.4, sweetSpot: "Business class to Spain", bestFor: "Spain / Europe" },
      { airline: "Singapore", program: "KrisFlyer", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.9, sweetSpot: "Saver awards on Singapore Air", bestFor: "Suites class" },
      { airline: "Southwest", program: "Rapid Rewards", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.4, sweetSpot: "Good with companion pass", bestFor: "Domestic travel" },
      { airline: "United", program: "MileagePlus", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Saver awards — watch partner space", bestFor: "Star Alliance partners" },
      { airline: "Virgin Atlantic", program: "Flying Club", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Delta One transatlantic", bestFor: "Delta premium" },
      { airline: "Hyatt", program: "World of Hyatt", type: "hotel", ratio: "1:1", ratioNum: 1, cpp: 2.3, sweetSpot: "Category 1-7 free nights", bestFor: "Luxury hotels" },
      { airline: "IHG", program: "IHG One Rewards", type: "hotel", ratio: "1:1", ratioNum: 1, cpp: 0.6, sweetSpot: "Limited value", bestFor: "IHG properties" },
      { airline: "Marriott Bonvoy", program: "Marriott Bonvoy", type: "hotel", ratio: "1:1", ratioNum: 1, cpp: 0.7, sweetSpot: "Mid-tier properties", bestFor: "Marriott stays" },
    ],
  },
  {
    program: "Capital One Miles",
    slug: "venture_x",
    color: "#D03027",
    sourceCpp: 1.85,
    notes: "Turkish Miles&Smiles is extremely valuable for Star Alliance awards, especially to Asia.",
    partners: [
      { airline: "Air Canada", program: "Aeroplan", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 2.0, sweetSpot: "Star Alliance saver awards", bestFor: "Star Alliance J/F" },
      { airline: "Air France / KLM", program: "Flying Blue", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Promo awards", bestFor: "Europe premium" },
      { airline: "Avianca", program: "LifeMiles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.9, sweetSpot: "Star Alliance partner awards", bestFor: "Star Alliance" },
      { airline: "British Airways", program: "Avios", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Short-haul on American", bestFor: "Short domestic" },
      { airline: "Cathay Pacific", program: "Asia Miles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Business to Asia", bestFor: "Asia premium" },
      { airline: "Emirates", program: "Skywards", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.3, sweetSpot: "Emirates premium", bestFor: "Emirates First" },
      { airline: "Etihad", program: "Guest Miles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.6, sweetSpot: "Luxury first class", bestFor: "Etihad The Residence" },
      { airline: "Singapore", program: "KrisFlyer", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.9, sweetSpot: "Singapore Suites", bestFor: "Asia first class" },
      { airline: "Turkish", program: "Miles&Smiles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 2.2, sweetSpot: "Business to Japan from 45k", bestFor: "Cheap Star Alliance J" },
      { airline: "EVA Air", program: "Infinity MileageLands", type: "airline", ratio: "2:1.5", ratioNum: 0.75, cpp: 1.7, sweetSpot: "Royal Laurel (business) to Asia", bestFor: "Taiwan & Asia" },
    ],
  },
  {
    program: "Bilt Points",
    slug: "bilt_blue",
    color: "#7B61FF",
    sourceCpp: 2.1,
    notes: "One of the best transfer currencies — same 1:1 ratio as Amex/Chase but on rent spend.",
    partners: [
      { airline: "Air Canada", program: "Aeroplan", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 2.0, sweetSpot: "Star Alliance saver awards", bestFor: "Star Alliance J/F" },
      { airline: "Air France / KLM", program: "Flying Blue", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Promo awards", bestFor: "Europe premium" },
      { airline: "Alaska", program: "Mileage Plan", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Cathay Pacific in First", bestFor: "West Coast + partners" },
      { airline: "American", program: "AAdvantage", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Partner award to Asia/Europe", bestFor: "Oneworld partners" },
      { airline: "British Airways", program: "Avios", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Short-haul on AA", bestFor: "Short hops" },
      { airline: "Cathay Pacific", program: "Asia Miles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.8, sweetSpot: "Business to Asia from 70k", bestFor: "Asia premium" },
      { airline: "Emirates", program: "Skywards", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.3, sweetSpot: "Emirates First", bestFor: "Emirates premium" },
      { airline: "Singapore", program: "KrisFlyer", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.9, sweetSpot: "Singapore Suites", bestFor: "Asia first class" },
      { airline: "Southwest", program: "Rapid Rewards", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.4, sweetSpot: "Good with companion pass", bestFor: "Domestic travel" },
      { airline: "Turkish", program: "Miles&Smiles", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 2.2, sweetSpot: "Business to Japan from 45k", bestFor: "Cheap J class" },
      { airline: "United", program: "MileagePlus", type: "airline", ratio: "1:1", ratioNum: 1, cpp: 1.5, sweetSpot: "Star Alliance saver awards", bestFor: "Star Alliance" },
      { airline: "Hyatt", program: "World of Hyatt", type: "hotel", ratio: "1:1", ratioNum: 1, cpp: 2.3, sweetSpot: "Category 1-7 free nights", bestFor: "Luxury hotels" },
      { airline: "IHG", program: "IHG One Rewards", type: "hotel", ratio: "1:1", ratioNum: 1, cpp: 0.6, sweetSpot: "Limited value", bestFor: "IHG properties" },
      { airline: "Marriott Bonvoy", program: "Marriott Bonvoy", type: "hotel", ratio: "1:3", ratioNum: 3, cpp: 0.7, bestFor: "Marriott stays" },
    ],
  },
  {
    program: "Southwest Rapid Rewards",
    slug: "chase_southwest",
    color: "#304CB2",
    sourceCpp: 1.4,
    notes: "Southwest points don't transfer to airlines — best used for Southwest flights and companion pass strategy.",
    partners: [],
  },
];

const CPP_COLORS = (cpp: number) => {
  if (cpp >= 2.0) return "text-semantic-income";
  if (cpp >= 1.5) return "text-honey";
  if (cpp >= 1.0) return "text-ink-secondary";
  return "text-semantic-expense";
};

export function TransferPartners() {
  const [activeProgram, setActiveProgram] = useState(PROGRAMS[0].slug);
  const [filter, setFilter] = useState<"all" | "airline" | "hotel">("all");

  const prog = PROGRAMS.find(p => p.slug === activeProgram)!;
  const filtered = prog.partners
    .filter(p => filter === "all" || p.type === filter)
    .sort((a, b) => b.cpp - a.cpp);

  return (
    <div className="space-y-4">
      {/* Program tabs */}
      <div className="flex gap-2 flex-wrap">
        {PROGRAMS.map(p => (
          <button
            key={p.slug}
            onClick={() => setActiveProgram(p.slug)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border",
              activeProgram === p.slug
                ? "text-[#0B0C0F] border-transparent"
                : "text-ink-tertiary bg-transparent border-white/[0.08] hover:text-ink-secondary hover:border-white/[0.14]"
            )}
            style={activeProgram === p.slug ? { background: p.color, borderColor: p.color } : {}}
          >
            {p.program}
          </button>
        ))}
      </div>

      {/* Program card */}
      <GlassCard className="overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: prog.color }}
              />
              <p className="text-[14px] font-semibold text-ink-primary">{prog.program}</p>
            </div>
            <p className="text-[12px] text-ink-tertiary flex items-center gap-1">
              <span>Base value:</span>
              <span className="text-honey font-medium">{prog.sourceCpp}¢ per point</span>
            </p>
            {prog.notes && (
              <p className="text-[11px] text-ink-tertiary/80 mt-1.5 flex gap-1.5 items-start">
                <Info size={11} className="shrink-0 mt-0.5 text-ink-ghost" />
                {prog.notes}
              </p>
            )}
          </div>

          {/* Type filter */}
          <div className="flex gap-1 shrink-0">
            {(["all", "airline", "hotel"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide transition-colors",
                  filter === f
                    ? "bg-white/[0.08] text-ink-primary"
                    : "text-ink-ghost hover:text-ink-tertiary"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Partners table */}
        {prog.partners.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-ink-tertiary">
            Southwest Rapid Rewards does not transfer to other loyalty programs.<br />
            <span className="text-[11px] text-ink-ghost">
              Best used directly for Southwest flights or with the Companion Pass strategy.
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-tertiary">
            No {filter} partners for this program.
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="px-5 py-2 flex items-center gap-4 bg-black/[0.10] border-b border-white/[0.04]">
              <p className="text-[10px] font-medium text-ink-ghost uppercase tracking-wide flex-1">Partner Program</p>
              <p className="text-[10px] font-medium text-ink-ghost uppercase tracking-wide w-16 text-right">Ratio</p>
              <p className="text-[10px] font-medium text-ink-ghost uppercase tracking-wide w-20 text-right">Est. Value</p>
              <p className="text-[10px] font-medium text-ink-ghost uppercase tracking-wide w-40 hidden md:block">Best For</p>
              <p className="text-[10px] font-medium text-ink-ghost uppercase tracking-wide w-48 hidden lg:block">Sweet Spot</p>
            </div>

            <div className="divide-y divide-white/[0.035]">
              {filtered.map((p) => (
                <div
                  key={p.program}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Icon + name */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="text-ink-ghost shrink-0">
                      {p.type === "airline" ? <Plane size={12} /> : <Hotel size={12} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink-primary truncate">{p.airline}</p>
                      <p className="text-[11px] text-ink-tertiary">{p.program}</p>
                    </div>
                  </div>

                  {/* Ratio */}
                  <div className="w-16 text-right shrink-0">
                    <span className="text-[12px] font-mono text-ink-secondary">{p.ratio}</span>
                  </div>

                  {/* Estimated value */}
                  <div className="w-20 text-right shrink-0">
                    <span className={cn("text-[13px] font-mono font-semibold", CPP_COLORS(p.cpp))}>
                      {p.cpp.toFixed(1)}¢
                    </span>
                  </div>

                  {/* Best for — hide on mobile */}
                  <div className="w-40 hidden md:block shrink-0">
                    <p className="text-[11px] text-ink-tertiary truncate">{p.bestFor ?? "—"}</p>
                  </div>

                  {/* Sweet spot — hide on smaller screens */}
                  <div className="w-48 hidden lg:block shrink-0">
                    <p className="text-[11px] text-ink-tertiary/70 truncate">{p.sweetSpot ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>

      {/* Value legend */}
      <div className="flex items-center gap-4 px-1">
        <p className="text-[10px] text-ink-ghost uppercase tracking-wide">Value guide:</p>
        {([
          { label: "≥ 2.0¢  Excellent", color: "text-semantic-income" },
          { label: "1.5–2.0¢  Good",    color: "text-honey" },
          { label: "1.0–1.5¢  Fair",    color: "text-ink-secondary" },
          { label: "< 1.0¢  Poor",      color: "text-semantic-expense" },
        ]).map(({ label, color }) => (
          <p key={label} className={cn("text-[10px]", color)}>{label}</p>
        ))}
      </div>

      {/* Transfer bonus tracker */}
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-ink-primary mb-1">Transfer Bonus Tracker</p>
            <p className="text-[12px] text-ink-tertiary mb-3">
              Transfer bonuses (20–40% extra miles) are offered periodically by programs. Check these sources before transferring.
            </p>
            <div className="space-y-2">
              {[
                { name: "The Points Guy — Transfer Bonuses", url: "https://thepointsguy.com/guide/current-transfer-bonuses/", desc: "Curated list of active transfer bonuses across all programs" },
                { name: "Doctor of Credit", url: "https://www.doctorofcredit.com", desc: "Community-sourced transfer bonus tracking and data points" },
                { name: "Frequent Miler", url: "https://frequentmiler.com/transfer-bonus/", desc: "Detailed analysis of transfer bonuses and sweet spots" },
              ].map(({ name, url, desc }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.10] transition-all group"
                >
                  <ExternalLink size={13} className="text-ink-ghost group-hover:text-honey transition-colors mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-ink-secondary group-hover:text-ink-primary transition-colors">{name}</p>
                    <p className="text-[11px] text-ink-tertiary mt-0.5">{desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
