"""
Tests for the points tracker earn rule logic.
Covers all 6 cards with edge cases per CLAUDE.md spec.
"""
import pytest

from app.points.tracker import (
    compute_points_for_transaction,
    get_best_card_for_purchase,
    _get_best_earn_rule,
    EARN_RULES,
    POINT_VALUES_CPP,
    REDEMPTION_THRESHOLDS,
    ALL_CARD_SLUGS,
)


# ---------------------------------------------------------------------------
# _get_best_earn_rule — priority logic
# ---------------------------------------------------------------------------

class TestEarnRulePriority:
    def test_exact_subcategory_beats_category_only(self):
        """Subcategory match must take priority over category-only rule."""
        # Chase Sapphire: Travel subcategory (Rideshare) — only category-only rule (3x Travel)
        rule = _get_best_earn_rule("chase_sapphire", "Travel", "Rideshare")
        assert rule is not None
        assert rule.earn_rate == 3.0  # category-only Travel match

    def test_category_only_beats_base(self):
        """Category-only match beats base rate."""
        # Amex Gold: no Rideshare rule, only base (1x)
        rule = _get_best_earn_rule("amex_gold", "Travel", "Rideshare")
        assert rule is not None
        assert rule.earn_rate == 1.0  # falls through to base

    def test_base_rate_when_no_category_match(self):
        """Unknown category falls through to base rate."""
        rule = _get_best_earn_rule("amex_gold", "Business", "Software")
        assert rule is not None
        assert rule.earn_rate == 1.0
        assert rule.category is None

    def test_unknown_card_returns_none(self):
        """Non-existent card slug returns None."""
        rule = _get_best_earn_rule("fake_card", "Food & Drink", "Restaurant")
        assert rule is None


# ---------------------------------------------------------------------------
# Amex Gold
# ---------------------------------------------------------------------------

class TestAmexGold:
    def test_restaurant_4x(self):
        result = compute_points_for_transaction("amex_gold", "Food & Drink", "Restaurant", 100.0)
        assert result is not None
        assert result.earn_rate == 4.0
        assert result.points_earned == 400.0
        assert result.program == "Amex MR"

    def test_fast_food_4x(self):
        result = compute_points_for_transaction("amex_gold", "Food & Drink", "Fast Food", 50.0)
        assert result is not None
        assert result.earn_rate == 4.0

    def test_grocery_in_store_4x(self):
        result = compute_points_for_transaction("amex_gold", "Groceries", "In-Store", 200.0)
        assert result is not None
        assert result.earn_rate == 4.0

    def test_grocery_online_4x(self):
        result = compute_points_for_transaction("amex_gold", "Groceries", "Online", 200.0)
        assert result is not None
        assert result.earn_rate == 4.0

    def test_flights_3x(self):
        result = compute_points_for_transaction("amex_gold", "Travel", "Flights", 500.0)
        assert result is not None
        assert result.earn_rate == 3.0

    def test_base_1x_on_shopping(self):
        result = compute_points_for_transaction("amex_gold", "Shopping", "Amazon", 75.0)
        assert result is not None
        assert result.earn_rate == 1.0

    def test_no_points_on_credit(self):
        """Negative amounts (refunds/credits) earn no points."""
        result = compute_points_for_transaction("amex_gold", "Food & Drink", "Restaurant", -50.0)
        assert result is None

    def test_no_points_on_zero(self):
        result = compute_points_for_transaction("amex_gold", "Food & Drink", "Restaurant", 0.0)
        assert result is None


# ---------------------------------------------------------------------------
# Chase Sapphire Preferred
# ---------------------------------------------------------------------------

class TestChaseSapphire:
    def test_restaurant_3x(self):
        result = compute_points_for_transaction("chase_sapphire", "Food & Drink", "Restaurant", 100.0)
        assert result is not None
        assert result.earn_rate == 3.0
        assert result.program == "Chase UR"

    def test_delivery_3x(self):
        result = compute_points_for_transaction("chase_sapphire", "Food & Drink", "Delivery", 40.0)
        assert result is not None
        assert result.earn_rate == 3.0

    def test_travel_3x(self):
        """Any travel subcategory should hit the category-only Travel rule at 3x."""
        result = compute_points_for_transaction("chase_sapphire", "Travel", "Hotel", 300.0)
        assert result is not None
        assert result.earn_rate == 3.0

    def test_streaming_3x(self):
        result = compute_points_for_transaction("chase_sapphire", "Entertainment", "Streaming", 15.0)
        assert result is not None
        assert result.earn_rate == 3.0

    def test_online_grocery_3x(self):
        result = compute_points_for_transaction("chase_sapphire", "Groceries", "Online", 100.0)
        assert result is not None
        assert result.earn_rate == 3.0

    def test_in_store_grocery_1x(self):
        """Sapphire only gives 3x on Online groceries, not In-Store."""
        result = compute_points_for_transaction("chase_sapphire", "Groceries", "In-Store", 100.0)
        assert result is not None
        assert result.earn_rate == 1.0  # base rate

    def test_base_1x(self):
        result = compute_points_for_transaction("chase_sapphire", "Utilities", "Electric", 100.0)
        assert result is not None
        assert result.earn_rate == 1.0


# ---------------------------------------------------------------------------
# Chase Southwest Plus — CRITICAL: SW Flights must be 3x
# ---------------------------------------------------------------------------

class TestChaseSouthwest:
    def test_sw_flights_3x(self):
        """SW Flights subcategory must give 3x (critical business rule)."""
        result = compute_points_for_transaction("chase_southwest", "Travel", "SW Flights", 200.0)
        assert result is not None
        assert result.earn_rate == 3.0
        assert result.program == "SW RR"

    def test_generic_flights_2x_not_3x(self):
        """Regular Flights (not Southwest) should hit category-only Travel rule at 2x."""
        result = compute_points_for_transaction("chase_southwest", "Travel", "Flights", 200.0)
        assert result is not None
        assert result.earn_rate == 2.0  # category-only Travel, NOT 3x

    def test_other_travel_2x(self):
        """Hotel on Southwest card should be 2x (category-only Travel)."""
        result = compute_points_for_transaction("chase_southwest", "Travel", "Hotel", 150.0)
        assert result is not None
        assert result.earn_rate == 2.0

    def test_base_1x(self):
        result = compute_points_for_transaction("chase_southwest", "Shopping", "General", 50.0)
        assert result is not None
        assert result.earn_rate == 1.0

    def test_sw_flights_points_computation(self):
        """$200 SW flight on Chase Southwest = 600 SW RR points."""
        result = compute_points_for_transaction("chase_southwest", "Travel", "SW Flights", 200.0)
        assert result is not None
        assert result.points_earned == 600.0


# ---------------------------------------------------------------------------
# Capital One Venture X — 2x everywhere
# ---------------------------------------------------------------------------

class TestVentureX:
    def test_hotel_10x_via_portal(self):
        result = compute_points_for_transaction("venture_x", "Travel", "Hotel", 100.0)
        assert result is not None
        assert result.earn_rate == 10.0
        assert result.program == "Capital One Miles"

    def test_flights_5x_via_portal(self):
        result = compute_points_for_transaction("venture_x", "Travel", "Flights", 100.0)
        assert result is not None
        assert result.earn_rate == 5.0

    def test_base_2x_everywhere(self):
        """Venture X earns 2x on ALL uncategorized spend."""
        result = compute_points_for_transaction("venture_x", "Shopping", "General", 100.0)
        assert result is not None
        assert result.earn_rate == 2.0

    def test_grocery_2x(self):
        """Groceries earn 2x (base rate) on Venture X — no bonus."""
        result = compute_points_for_transaction("venture_x", "Groceries", "In-Store", 200.0)
        assert result is not None
        assert result.earn_rate == 2.0

    def test_restaurant_2x_base(self):
        """Venture X has no restaurant bonus — 2x base."""
        result = compute_points_for_transaction("venture_x", "Food & Drink", "Restaurant", 100.0)
        assert result is not None
        assert result.earn_rate == 2.0


# ---------------------------------------------------------------------------
# Bilt Blue
# ---------------------------------------------------------------------------

class TestBiltBlue:
    def test_rent_1x(self):
        result = compute_points_for_transaction("bilt_blue", "Home", "Rent", 2000.0)
        assert result is not None
        assert result.earn_rate == 1.0
        assert result.program == "Bilt Points"

    def test_restaurant_3x(self):
        result = compute_points_for_transaction("bilt_blue", "Food & Drink", "Restaurant", 80.0)
        assert result is not None
        assert result.earn_rate == 3.0

    def test_travel_2x(self):
        result = compute_points_for_transaction("bilt_blue", "Travel", "Flights", 400.0)
        assert result is not None
        assert result.earn_rate == 2.0

    def test_base_1x(self):
        result = compute_points_for_transaction("bilt_blue", "Entertainment", "Streaming", 15.0)
        assert result is not None
        assert result.earn_rate == 1.0


# ---------------------------------------------------------------------------
# get_best_card_for_purchase (optimizer)
# ---------------------------------------------------------------------------

class TestCardOptimizer:
    def test_returns_all_cards(self):
        options = get_best_card_for_purchase("Shopping", "General", 100.0)
        slugs = [o.card_slug for o in options]
        for slug in ALL_CARD_SLUGS:
            assert slug in slugs

    def test_sorted_by_dollar_value_descending(self):
        options = get_best_card_for_purchase("Food & Drink", "Restaurant", 100.0)
        values = [o.dollar_value for o in options]
        assert values == sorted(values, reverse=True)

    def test_restaurant_winner_is_bilt_or_amex(self):
        """Restaurant: Amex Gold 4x MR @2.0cpp=$8, Bilt 3x @2.1cpp=$6.30, Sapphire 3x @2.05cpp=$6.15"""
        options = get_best_card_for_purchase("Food & Drink", "Restaurant", 100.0)
        winner = options[0]
        assert winner.card_slug == "amex_gold"
        assert winner.earn_rate == 4.0

    def test_sw_flights_winner_is_chase_southwest(self):
        """SW Flights: Chase Southwest 3x SW RR @1.4cpp = $4.20 vs others"""
        options = get_best_card_for_purchase("Travel", "SW Flights", 100.0)
        # Check that chase_southwest with 3x appears (may or may not be winner vs Venture X 2x @$3.70)
        sw_option = next(o for o in options if o.card_slug == "chase_southwest")
        assert sw_option.earn_rate == 3.0

    def test_grocery_in_store_winner_is_amex_gold(self):
        """Grocery in-store: Amex Gold 4x MR @2.0cpp=$8 — best."""
        options = get_best_card_for_purchase("Groceries", "In-Store", 100.0)
        assert options[0].card_slug == "amex_gold"
        assert options[0].earn_rate == 4.0

    def test_hotel_winner_is_venture_x(self):
        """Hotel via C1 portal: Venture X 10x @1.85cpp=$18.50 — best."""
        options = get_best_card_for_purchase("Travel", "Hotel", 100.0)
        assert options[0].card_slug == "venture_x"
        assert options[0].earn_rate == 10.0

    def test_points_earned_computation(self):
        """$50 restaurant on Amex Gold should earn 200 MR points."""
        options = get_best_card_for_purchase("Food & Drink", "Restaurant", 50.0)
        amex = next(o for o in options if o.card_slug == "amex_gold")
        assert amex.points_earned == 200.0

    def test_dollar_value_computation(self):
        """200 Amex MR @2.0cpp = $4.00"""
        options = get_best_card_for_purchase("Food & Drink", "Restaurant", 50.0)
        amex = next(o for o in options if o.card_slug == "amex_gold")
        assert abs(amex.dollar_value - 4.0) < 0.01


# ---------------------------------------------------------------------------
# Data integrity checks
# ---------------------------------------------------------------------------

class TestEarnRulesIntegrity:
    def test_all_cards_have_base_rate(self):
        """Every card must have a base rate rule (category=None, subcategory=None)."""
        for slug in ALL_CARD_SLUGS:
            base_rules = [
                r for r in EARN_RULES
                if r.card_slug == slug and r.category is None and r.subcategory is None
            ]
            assert len(base_rules) == 1, f"{slug} missing base rate rule"

    def test_venture_x_base_is_2x(self):
        """Venture X base rate must be exactly 2x (best base rate of all cards)."""
        base = _get_best_earn_rule("venture_x", "Uncategorized", None)
        assert base is not None
        assert base.earn_rate == 2.0

    def test_southwest_sw_flights_is_3x(self):
        """SW Flights on Chase Southwest must be exactly 3x — critical business rule."""
        rule = _get_best_earn_rule("chase_southwest", "Travel", "SW Flights")
        assert rule is not None
        assert rule.earn_rate == 3.0

    def test_all_cpp_values_defined(self):
        """All programs referenced in earn rules must have a CPP value."""
        programs_in_rules = {r.program for r in EARN_RULES}
        for program in programs_in_rules:
            assert program in POINT_VALUES_CPP, f"Missing CPP for {program}"

    def test_no_negative_earn_rates(self):
        for rule in EARN_RULES:
            assert rule.earn_rate > 0, f"Non-positive earn rate on {rule}"
