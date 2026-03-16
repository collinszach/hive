/**
 * Tests for budget gauge (BudgetRow) display logic.
 * We test the core logic extracted from the page component:
 * - correct % used calculated from actual_spend / budget_amount
 * - correct color class: green (<80%), yellow (80-100%), red (>100%)
 * - correct remaining / over budget label
 */
import { describe, it, expect } from "vitest";

// Replicate the pure display logic from BudgetRow in budgets/page.tsx
function getBudgetColor(pctUsed: number): string {
  if (pctUsed > 100) return "bg-red-500";
  if (pctUsed > 80) return "bg-yellow-400";
  return "bg-emerald-500";
}

function getBarWidth(pctUsed: number): number {
  return Math.min(pctUsed, 100);
}

function getRemainingLabel(remaining: number): string {
  return remaining >= 0
    ? `$${Math.abs(remaining).toLocaleString()} remaining`
    : `$${Math.abs(remaining).toLocaleString()} over budget`;
}

describe("BudgetRow color logic", () => {
  it("shows green when under 80%", () => {
    expect(getBudgetColor(0)).toBe("bg-emerald-500");
    expect(getBudgetColor(50)).toBe("bg-emerald-500");
    expect(getBudgetColor(79)).toBe("bg-emerald-500");
  });

  it("shows yellow when between 80% and 100%", () => {
    expect(getBudgetColor(80.1)).toBe("bg-yellow-400");
    expect(getBudgetColor(90)).toBe("bg-yellow-400");
    expect(getBudgetColor(100)).toBe("bg-yellow-400");
  });

  it("shows red when over 100%", () => {
    expect(getBudgetColor(100.1)).toBe("bg-red-500");
    expect(getBudgetColor(150)).toBe("bg-red-500");
    expect(getBudgetColor(200)).toBe("bg-red-500");
  });
});

describe("BudgetRow bar width", () => {
  it("caps bar at 100% when over budget", () => {
    expect(getBarWidth(150)).toBe(100);
    expect(getBarWidth(200)).toBe(100);
  });

  it("shows exact percentage when under budget", () => {
    expect(getBarWidth(0)).toBe(0);
    expect(getBarWidth(50)).toBe(50);
    expect(getBarWidth(99)).toBe(99);
    expect(getBarWidth(100)).toBe(100);
  });
});

describe("BudgetRow remaining label", () => {
  it("shows 'remaining' when under budget", () => {
    expect(getRemainingLabel(200)).toContain("remaining");
    expect(getRemainingLabel(0)).toContain("remaining");
  });

  it("shows 'over budget' when over budget", () => {
    expect(getRemainingLabel(-50)).toContain("over budget");
    expect(getRemainingLabel(-1)).toContain("over budget");
  });
});

describe("Budget % used calculation", () => {
  const cases: [number, number, number][] = [
    [0, 500, 0],
    [250, 500, 50],
    [500, 500, 100],
    [600, 500, 120],
    [400, 400, 100],
  ];

  it.each(cases)("actual=%d / budget=%d → %d%%", (actual, budget, expected) => {
    const pct = (actual / budget) * 100;
    expect(Math.round(pct)).toBe(expected);
  });
});
