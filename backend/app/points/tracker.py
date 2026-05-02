"""
Points tracker — earn rules, optimizer, and per-transaction computation.

All earn rules are defined here as the single source of truth.
Priority: exact subcategory match > category-only match > base rate.
"""
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

# ---------------------------------------------------------------------------
# Earn Rules
# ---------------------------------------------------------------------------

@dataclass
class EarnRuleData:
    card_slug: str
    category: Optional[str]
    subcategory: Optional[str]
    earn_rate: float
    program: str


# Complete earn rules table — mirrors CLAUDE.md exactly
EARN_RULES: list[EarnRuleData] = [
    # ── Amex Gold ──────────────────────────────────────────────────────────────
    # 4x at US restaurants (all dining subcategories)
    EarnRuleData("amex_gold", "Food & Drink", "Restaurant", 4.0, "Amex MR"),
    EarnRuleData("amex_gold", "Food & Drink", "Fast Food",  4.0, "Amex MR"),
    EarnRuleData("amex_gold", "Food & Drink", "Coffee",     4.0, "Amex MR"),
    EarnRuleData("amex_gold", "Food & Drink", "Bar",        4.0, "Amex MR"),
    EarnRuleData("amex_gold", "Food & Drink", "Delivery",   4.0, "Amex MR"),
    # 4x at US supermarkets
    EarnRuleData("amex_gold", "Groceries", "In-Store", 4.0, "Amex MR"),
    EarnRuleData("amex_gold", "Groceries", "Online",   4.0, "Amex MR"),
    # 3x on flights booked directly with airlines
    EarnRuleData("amex_gold", "Travel", "Flights",    3.0, "Amex MR"),
    EarnRuleData("amex_gold", "Travel", "SW Flights", 3.0, "Amex MR"),
    # 1x base rate
    EarnRuleData("amex_gold", None, None, 1.0, "Amex MR"),

    # ── Chase Sapphire Preferred ────────────────────────────────────────────────
    # 3x on dining (all subcategories)
    EarnRuleData("chase_sapphire", "Food & Drink", "Restaurant", 3.0, "Chase UR"),
    EarnRuleData("chase_sapphire", "Food & Drink", "Fast Food",  3.0, "Chase UR"),
    EarnRuleData("chase_sapphire", "Food & Drink", "Coffee",     3.0, "Chase UR"),
    EarnRuleData("chase_sapphire", "Food & Drink", "Bar",        3.0, "Chase UR"),
    EarnRuleData("chase_sapphire", "Food & Drink", "Delivery",   3.0, "Chase UR"),
    # 3x on travel
    EarnRuleData("chase_sapphire", "Travel", None, 3.0, "Chase UR"),
    # 3x on online grocery (not in-store)
    EarnRuleData("chase_sapphire", "Groceries", "Online", 3.0, "Chase UR"),
    # 3x on select streaming
    EarnRuleData("chase_sapphire", "Entertainment", "Streaming", 3.0, "Chase UR"),
    # 1x base
    EarnRuleData("chase_sapphire", None, None, 1.0, "Chase UR"),

    # ── Chase Southwest Plus ────────────────────────────────────────────────────
    # SW Flights MUST be 3x, not generic Travel 2x
    EarnRuleData("chase_southwest", "Travel", "SW Flights", 3.0, "SW RR"),
    EarnRuleData("chase_southwest", "Travel", None,         2.0, "SW RR"),
    EarnRuleData("chase_southwest", None, None,             1.0, "SW RR"),

    # ── Bilt Blue ───────────────────────────────────────────────────────────────
    # 1x on rent (no transaction fee)
    EarnRuleData("bilt_blue", "Home", "Rent", 1.0, "Bilt Points"),
    # 3x on dining (all subcategories)
    EarnRuleData("bilt_blue", "Food & Drink", "Restaurant", 3.0, "Bilt Points"),
    EarnRuleData("bilt_blue", "Food & Drink", "Fast Food",  3.0, "Bilt Points"),
    EarnRuleData("bilt_blue", "Food & Drink", "Coffee",     3.0, "Bilt Points"),
    EarnRuleData("bilt_blue", "Food & Drink", "Bar",        3.0, "Bilt Points"),
    EarnRuleData("bilt_blue", "Food & Drink", "Delivery",   3.0, "Bilt Points"),
    # 2x on travel
    EarnRuleData("bilt_blue", "Travel", None, 2.0, "Bilt Points"),
    # 1x base
    EarnRuleData("bilt_blue", None, None, 1.0, "Bilt Points"),

    # ── Capital One Venture X ────────────────────────────────────────────────────
    # 10x on hotels, 5x on flights (when booked via Capital One Travel)
    EarnRuleData("venture_x", "Travel", "Hotel",      10.0, "Capital One Miles"),
    EarnRuleData("venture_x", "Travel", "Flights",     5.0, "Capital One Miles"),
    EarnRuleData("venture_x", "Travel", "SW Flights",  5.0, "Capital One Miles"),
    # 2x on all other travel
    EarnRuleData("venture_x", "Travel", None, 2.0, "Capital One Miles"),
    # 2x everywhere (best base rate of any card)
    EarnRuleData("venture_x", None, None, 2.0, "Capital One Miles"),
]

# ---------------------------------------------------------------------------
# Point valuations (cents per point)
# ---------------------------------------------------------------------------

POINT_VALUES_CPP: dict[str, float] = {
    "Amex MR": 2.0,
    "Chase UR": 2.05,
    "SW RR": 1.4,
    "Bilt Points": 2.1,
    "Capital One Miles": 1.85,
}

REDEMPTION_THRESHOLDS: dict[str, int] = {
    "Chase UR": 60_000,
    "Amex MR": 75_000,
    "SW RR": 50_000,
    "Bilt Points": 50_000,
    "Capital One Miles": 75_000,
}

ALL_CARD_SLUGS = [
    "amex_gold",
    "chase_sapphire",
    "chase_southwest",
    "bilt_blue",
    "venture_x",
]

# ---------------------------------------------------------------------------
# Core matching logic
# ---------------------------------------------------------------------------

def _get_best_earn_rule(
    card_slug: str,
    category: Optional[str],
    subcategory: Optional[str],
) -> Optional[EarnRuleData]:
    """
    Find the best matching earn rule for a card + category + subcategory.
    Priority:
      1. Exact subcategory match (card_slug + category + subcategory)
      2. Category-only match (card_slug + category, subcategory IS NULL in rule)
      3. Base rate (card_slug only, both category AND subcategory IS NULL)
    """
    card_rules = [r for r in EARN_RULES if r.card_slug == card_slug]

    # Priority 1: exact subcategory match
    if category and subcategory:
        for rule in card_rules:
            if rule.category == category and rule.subcategory == subcategory:
                return rule

    # Priority 2: category-only match (rule has subcategory=None)
    if category:
        for rule in card_rules:
            if rule.category == category and rule.subcategory is None:
                return rule

    # Priority 3: base rate (both None)
    for rule in card_rules:
        if rule.category is None and rule.subcategory is None:
            return rule

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@dataclass
class CardOption:
    card_slug: str
    program: str
    earn_rate: float
    points_earned: float
    dollar_value: float  # estimated dollar value in dollars


def get_best_card_for_purchase(
    category: Optional[str],
    subcategory: Optional[str],
    amount: float,
) -> list[CardOption]:
    """
    Return all cards ranked by estimated dollar value for a given purchase.
    Best card is first.
    """
    options: list[CardOption] = []
    for card_slug in ALL_CARD_SLUGS:
        rule = _get_best_earn_rule(card_slug, category, subcategory)
        if rule is None:
            continue
        points = amount * rule.earn_rate
        cpp = POINT_VALUES_CPP.get(rule.program, 1.0)
        dollar_value = points * cpp / 100.0  # cpp is cents per point
        options.append(CardOption(
            card_slug=card_slug,
            program=rule.program,
            earn_rate=rule.earn_rate,
            points_earned=round(points, 2),
            dollar_value=round(dollar_value, 4),
        ))

    options.sort(key=lambda o: o.dollar_value, reverse=True)
    return options


@dataclass
class PointsResult:
    card_slug: str
    program: str
    earn_rate: float
    points_earned: float


def compute_points_for_transaction(
    card_slug: str,
    category: Optional[str],
    subcategory: Optional[str],
    amount: float,
) -> Optional[PointsResult]:
    """
    Compute points earned for a specific transaction on a specific card.
    Returns None if no earn rule matches (should not happen given base rates).
    Amount is positive for charges (Plaid convention: positive = money spent).
    """
    # Negative amounts are credits/refunds — no points earned
    if amount <= 0:
        return None

    rule = _get_best_earn_rule(card_slug, category, subcategory)
    if rule is None:
        return None

    points = amount * rule.earn_rate
    return PointsResult(
        card_slug=card_slug,
        program=rule.program,
        earn_rate=rule.earn_rate,
        points_earned=round(points, 2),
    )
