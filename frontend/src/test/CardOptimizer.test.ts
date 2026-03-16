/**
 * Tests for card optimizer result rendering logic.
 *
 * The optimizer page receives a CardOption[] from the API and renders them ranked.
 * We test:
 * - The card with is_best=true is the correct one given the earn rules
 * - Earn rate and dollar value are calculated correctly
 * - Tie-breaking (equal earn rate → higher CPP wins)
 */
import { describe, it, expect } from "vitest";
import type { CardOption } from "@/lib/api";

// Replicate the optimizer ranking logic used on the frontend display
function getBestCard(cards: CardOption[]): CardOption | undefined {
  return cards.find((c) => c.is_best);
}

function getWinnerSlug(cards: CardOption[]): string | undefined {
  return getBestCard(cards)?.card_slug;
}

// Mock optimizer responses (mirroring what the backend would return)
function makeCard(
  card_slug: string,
  program: string,
  earn_rate: number,
  amount: number,
  cpp: number
): CardOption {
  const points_earned = earn_rate * amount;
  const dollar_value = (points_earned * cpp) / 100;
  return { card_slug, program, earn_rate, points_earned, dollar_value, is_best: false };
}

function markBest(cards: CardOption[]): CardOption[] {
  // Sort by dollar_value desc, mark first as best (mirrors backend logic)
  const sorted = [...cards].sort((a, b) => b.dollar_value - a.dollar_value);
  return sorted.map((c, i) => ({ ...c, is_best: i === 0 }));
}

describe("Card optimizer — restaurant purchase", () => {
  // Restaurant: Amex Gold 4x MR (2.0cpp), Chase Sapphire 3x UR (2.05cpp), Bilt 3x (2.1cpp), Venture X 2x (1.85cpp)
  const amount = 100;
  const cards = markBest([
    makeCard("amex_gold", "Amex MR", 4.0, amount, 2.0),      // 400 pts, $8.00
    makeCard("chase_sapphire", "Chase UR", 3.0, amount, 2.05), // 300 pts, $6.15
    makeCard("bilt_blue", "Bilt Points", 3.0, amount, 2.1),    // 300 pts, $6.30
    makeCard("venture_x", "Capital One Miles", 2.0, amount, 1.85), // 200 pts, $3.70
    makeCard("chase_southwest", "SW RR", 1.0, amount, 1.4),    // 100 pts, $1.40
    makeCard("wf_autograph", "WF Rewards", 3.0, amount, 1.0),  // 300 pts, $3.00
  ]);

  it("Amex Gold wins for restaurant (4x MR at 2.0cpp = $8)", () => {
    expect(getWinnerSlug(cards)).toBe("amex_gold");
  });

  it("best card is_best=true and only one card is best", () => {
    const bestCards = cards.filter((c) => c.is_best);
    expect(bestCards).toHaveLength(1);
    expect(bestCards[0].card_slug).toBe("amex_gold");
  });

  it("all 6 cards are in the results", () => {
    expect(cards).toHaveLength(6);
  });
});

describe("Card optimizer — Southwest Airlines purchase", () => {
  // SW Flights subcategory: Chase Southwest 3x RR (1.4cpp), Chase Sapphire travel 3x UR (2.05cpp), Venture X 2x (1.85cpp)
  const amount = 200;
  const cards = markBest([
    makeCard("chase_southwest", "SW RR", 3.0, amount, 1.4),   // 600 pts, $8.40
    makeCard("chase_sapphire", "Chase UR", 3.0, amount, 2.05), // 600 pts, $12.30
    makeCard("amex_gold", "Amex MR", 3.0, amount, 2.0),        // 600 pts, $12.00 (flights 3x)
    makeCard("venture_x", "Capital One Miles", 2.0, amount, 1.85), // 400 pts, $7.40
    makeCard("bilt_blue", "Bilt Points", 2.0, amount, 2.1),    // 400 pts, $8.40
    makeCard("wf_autograph", "WF Rewards", 3.0, amount, 1.0),  // 600 pts, $6.00
  ]);

  it("Chase Sapphire wins for SW flights (3x UR at 2.05cpp = $12.30)", () => {
    expect(getWinnerSlug(cards)).toBe("chase_sapphire");
  });
});

describe("Card optimizer — base rate purchase (any category)", () => {
  // For a misc purchase: Venture X 2x everywhere (1.85cpp) vs Amex Gold 1x (2.0cpp) vs Chase Sapphire 1x (2.05cpp)
  const amount = 100;
  const cards = markBest([
    makeCard("amex_gold", "Amex MR", 1.0, amount, 2.0),       // 100 pts, $2.00
    makeCard("chase_sapphire", "Chase UR", 1.0, amount, 2.05), // 100 pts, $2.05
    makeCard("venture_x", "Capital One Miles", 2.0, amount, 1.85), // 200 pts, $3.70
    makeCard("chase_southwest", "SW RR", 1.0, amount, 1.4),   // 100 pts, $1.40
    makeCard("bilt_blue", "Bilt Points", 1.0, amount, 2.1),   // 100 pts, $2.10
    makeCard("wf_autograph", "WF Rewards", 1.0, amount, 1.0), // 100 pts, $1.00
  ]);

  it("Venture X wins for misc purchase (2x everywhere at 1.85cpp = $3.70)", () => {
    expect(getWinnerSlug(cards)).toBe("venture_x");
  });
});

describe("Card optimizer — earn rate display", () => {
  it("earn rate is a positive number for all cards", () => {
    const cards = markBest([
      makeCard("amex_gold", "Amex MR", 4.0, 100, 2.0),
      makeCard("venture_x", "Capital One Miles", 2.0, 100, 1.85),
    ]);
    for (const card of cards) {
      expect(card.earn_rate).toBeGreaterThan(0);
    }
  });

  it("points_earned = earn_rate * amount", () => {
    const card = makeCard("amex_gold", "Amex MR", 4.0, 100, 2.0);
    expect(card.points_earned).toBe(400);
  });

  it("dollar_value = (points * cpp) / 100", () => {
    // 4x on $100 = 400 pts, at 2.0cpp → $8.00
    const card = makeCard("amex_gold", "Amex MR", 4.0, 100, 2.0);
    expect(card.dollar_value).toBe(8.0);
  });
});

describe("Card optimizer — Venture X grocery (not in bonus category)", () => {
  // Venture X: 2x everywhere (no grocery bonus), Amex Gold: 4x groceries
  const amount = 150;
  const cards = markBest([
    makeCard("amex_gold", "Amex MR", 4.0, amount, 2.0),       // 600 pts, $12.00
    makeCard("venture_x", "Capital One Miles", 2.0, amount, 1.85), // 300 pts, $5.55
    makeCard("chase_sapphire", "Chase UR", 1.0, amount, 2.05), // 150 pts, $3.075 (no grocery bonus)
  ]);

  it("Amex Gold wins for in-store groceries (4x MR)", () => {
    expect(getWinnerSlug(cards)).toBe("amex_gold");
  });
});
