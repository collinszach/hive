import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fmt,
  fmtExact,
  fmtDate,
  currentMonth,
  monthLabel,
  SUBCATEGORIES,
  CARD_NAMES,
  ALL_CATEGORIES,
} from "@/lib/utils";

describe("fmt", () => {
  it("formats whole dollar amounts without cents", () => {
    expect(fmt(1234)).toBe("$1,234");
    expect(fmt(0)).toBe("$0");
    expect(fmt(1000000)).toBe("$1,000,000");
  });

  it("rounds to nearest dollar", () => {
    expect(fmt(99.99)).toBe("$100");
    expect(fmt(99.4)).toBe("$99");
  });

  it("formats negative amounts", () => {
    expect(fmt(-500)).toBe("-$500");
  });
});

describe("fmtExact", () => {
  it("always shows two decimal places", () => {
    expect(fmtExact(100)).toBe("$100.00");
    expect(fmtExact(99.5)).toBe("$99.50");
    expect(fmtExact(1234.56)).toBe("$1,234.56");
  });
});

describe("fmtDate", () => {
  it("formats ISO date strings to short month/day", () => {
    expect(fmtDate("2024-01-15")).toBe("Jan 15");
    expect(fmtDate("2024-12-01")).toBe("Dec 1");
    expect(fmtDate("2024-03-31")).toBe("Mar 31");
  });
});

describe("currentMonth", () => {
  it("returns current month in YYYY-MM format", () => {
    const result = currentMonth();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  it("returns the actual current year and month", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(currentMonth()).toBe(expected);
  });
});

describe("monthLabel", () => {
  it("formats YYYY-MM to human-readable month + year", () => {
    expect(monthLabel("2024-01")).toBe("January 2024");
    expect(monthLabel("2024-12")).toBe("December 2024");
    expect(monthLabel("2025-06")).toBe("June 2025");
  });
});

describe("SUBCATEGORIES", () => {
  it("Food & Drink has required subcategories for points rules", () => {
    const foodSubs = SUBCATEGORIES["Food & Drink"];
    expect(foodSubs).toContain("Restaurant");
    expect(foodSubs).toContain("Fast Food");
    expect(foodSubs).toContain("Delivery");
  });

  it("Travel has SW Flights as distinct subcategory from Flights", () => {
    const travelSubs = SUBCATEGORIES["Travel"];
    expect(travelSubs).toContain("Flights");
    expect(travelSubs).toContain("SW Flights");
    // They must be distinct entries
    const flightsIdx = travelSubs.indexOf("Flights");
    const swFlightsIdx = travelSubs.indexOf("SW Flights");
    expect(flightsIdx).not.toBe(swFlightsIdx);
  });

  it("Home has Rent for Bilt card rules", () => {
    expect(SUBCATEGORIES["Home"]).toContain("Rent");
  });

  it("Transportation has Gas and EV Charging for WF Autograph rules", () => {
    const transSubs = SUBCATEGORIES["Transportation"];
    expect(transSubs).toContain("Gas");
    expect(transSubs).toContain("EV Charging");
  });
});

describe("CARD_NAMES", () => {
  it("has a display name for every card slug", () => {
    const slugs = ["amex_gold", "chase_sapphire", "chase_southwest", "bilt_blue", "wf_autograph", "venture_x"];
    for (const slug of slugs) {
      expect(CARD_NAMES[slug]).toBeTruthy();
    }
  });
});

describe("ALL_CATEGORIES", () => {
  it("contains all major spend categories", () => {
    expect(ALL_CATEGORIES).toContain("Food & Drink");
    expect(ALL_CATEGORIES).toContain("Groceries");
    expect(ALL_CATEGORIES).toContain("Travel");
    expect(ALL_CATEGORIES).toContain("Transportation");
    expect(ALL_CATEGORIES).toContain("Entertainment");
    expect(ALL_CATEGORIES).toContain("Shopping");
  });
});
