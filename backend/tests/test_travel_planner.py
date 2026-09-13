"""The travel planner's decision engine.

The product is the comparison board: cash versus each points currency, ranked against
your own valuation. These test the maths behind it, with no DB and no external APIs.
"""
import pytest

from app.points.tracker import POINT_VALUES_CPP
from app.travel.affordability import judge_cash, routes_for_award, spend_it_advice
from app.travel.transfer_partners import (
    NON_TRANSFERABLE,
    TRANSFER_PARTNERS,
    is_transferable,
    partners_for,
    points_needed,
    programs_reaching,
)
from app.travel.valuation import cents_per_point, judge, true_cost

# The real balances this was designed against.
BALANCES = {
    "Amex MR": 219_662.0,
    "Chase UR": 110_798.0,
    "Capital One Miles": 135_135.0,
    "SW RR": 96_638.0,
    "Bilt Points": 46_670.0,
}


class TestCentsPerPoint:
    def test_backs_out_the_cash_still_paid(self):
        # 60k points + $89 replacing a $1,479 fare is ($1479-$89)/60000 = 2.317¢
        assert cents_per_point(1479.0, 60_000.0, 89.0) == pytest.approx(2.317, abs=0.001)

    def test_fees_reduce_the_value(self):
        with_fees = cents_per_point(1000.0, 50_000.0, 200.0)
        without = cents_per_point(1000.0, 50_000.0, 0.0)
        assert with_fees < without

    def test_unknown_cash_price_is_none_not_zero(self):
        # A zero would drag every average down and imply the award was worthless.
        assert cents_per_point(None, 60_000.0, 89.0) is None

    def test_zero_points_is_none_not_a_division_error(self):
        assert cents_per_point(500.0, 0.0) is None
        assert cents_per_point(500.0, None) is None

    def test_fees_exceeding_the_fare_go_negative(self):
        # A real signal: you paid more in fees than the ticket was worth.
        assert cents_per_point(100.0, 50_000.0, 200.0) < 0


class TestJudge:
    def test_beats_baseline_is_praised(self):
        v = judge(1479.0, 60_000.0, "Amex MR", 89.0)
        assert v.rating == "great"
        assert "2.00" in v.summary            # the Amex MR baseline

    def test_below_baseline_is_called_out(self):
        # 50k Amex MR for a $500 fare is 1.0¢ against a 2.0¢ baseline.
        v = judge(500.0, 50_000.0, "Amex MR")
        assert v.rating == "poor"
        assert "elsewhere" in v.summary

    def test_around_baseline_is_fair(self):
        baseline = POINT_VALUES_CPP["Chase UR"]
        cash = baseline / 100 * 50_000
        assert judge(cash, 50_000.0, "Chase UR").rating == "fair"

    def test_unknown_program_still_reports_cpp(self):
        v = judge(1000.0, 50_000.0, "Some Other Program")
        assert v.rating == "unknown"
        assert v.cpp == pytest.approx(2.0)

    def test_missing_cash_price_asks_for_it(self):
        v = judge(None, 60_000.0, "Amex MR")
        assert v.rating == "unknown"
        assert "cash price" in v.summary.lower()

    def test_every_held_program_has_a_baseline(self):
        # Without one, judge() can only ever say "unknown" for that currency.
        for program in BALANCES:
            assert program in POINT_VALUES_CPP, f"{program} has no valuation"


class TestTrueCost:
    def test_award_costs_fees_plus_the_value_of_points_burnt(self):
        # 60k Amex MR at 2.0¢ = $1,200, plus $89 fees.
        assert true_cost(None, 60_000.0, "Amex MR", 89.0) == 1289.0

    def test_cash_option_is_just_its_price(self):
        assert true_cost(1402.0, None, None) == 1402.0

    def test_points_are_not_treated_as_free(self):
        # The whole point: an award is not cheaper just because little cash moves.
        award = true_cost(None, 100_000.0, "Amex MR", 0.0)
        cash = true_cost(500.0, None, None)
        assert award > cash

    def test_comparable_across_currencies(self):
        # Same cash value, different currencies — ranking must still work.
        a = true_cost(None, 60_000.0, "Amex MR")        # 2.0¢  → $1,200
        b = true_cost(None, 60_000.0, "SW RR")          # 1.4¢  → $840
        assert a > b


class TestTransferPartners:
    def test_southwest_cannot_transfer_out(self):
        # The asymmetry the planner has to encode: SW RR only works on Southwest.
        assert partners_for("SW RR") == []
        assert is_transferable("SW RR") is False
        assert "SW RR" in NON_TRANSFERABLE

    def test_transferable_currencies_have_partners(self):
        for program in ("Amex MR", "Chase UR", "Capital One Miles", "Bilt Points"):
            assert is_transferable(program), f"{program} should be transferable"

    def test_hyatt_is_reachable_from_ur_and_bilt(self):
        reaching = {p.from_program for p in programs_reaching("Hyatt")}
        assert "Chase UR" in reaching
        assert "Bilt Points" in reaching

    def test_every_row_is_dated(self):
        # A stale ratio presented as current is worse than no ratio.
        for p in TRANSFER_PARTNERS:
            assert p.verified_on is not None

    def test_ratios_are_positive(self):
        for p in TRANSFER_PARTNERS:
            assert p.ratio > 0, f"{p.from_program}→{p.to_partner} has a non-positive ratio"

    def test_no_self_transfers(self):
        for p in TRANSFER_PARTNERS:
            assert p.from_program.lower() not in p.to_partner.lower() or p.kind == "hotel"


class TestPointsNeeded:
    def test_one_to_one(self):
        assert points_needed(60_000, 1.0) == 60_000

    def test_favourable_ratio_needs_fewer_source_points(self):
        # 1:2 into Hilton — 50k Hilton needs only 25k MR.
        assert points_needed(50_000, 2.0) == 25_000

    def test_unfavourable_ratio_needs_more(self):
        assert points_needed(50_000, 0.5) == 100_000

    def test_zero_ratio_rejected(self):
        with pytest.raises(ValueError):
            points_needed(1000, 0)


class TestRoutesForAward:
    def test_finds_every_currency_that_reaches_the_partner(self):
        routes = routes_for_award(
            target_program="Air Canada Aeroplan", points_price=60_000, balances=BALANCES
        )
        programs = {r.program for r in routes}
        assert {"Amex MR", "Chase UR", "Capital One Miles", "Bilt Points"} <= programs
        # SW RR reaches nothing, so it must not appear.
        assert "SW RR" not in programs

    def test_covered_routes_rank_first(self):
        routes = routes_for_award(
            target_program="Air Canada Aeroplan", points_price=60_000, balances=BALANCES
        )
        covered = [r.covered for r in routes]
        assert covered == sorted(covered, reverse=True)

    def test_shortfall_is_reported_not_hidden(self):
        # Bilt has 46,670 — 13,330 short of a 60k award.
        routes = routes_for_award(
            target_program="Air Canada Aeroplan", points_price=60_000, balances=BALANCES
        )
        bilt = next(r for r in routes if r.program == "Bilt Points")
        assert bilt.covered is False
        assert bilt.shortfall == pytest.approx(13_330.0)

    def test_transfers_carry_the_one_way_warning(self):
        routes = routes_for_award(
            target_program="Air Canada Aeroplan", points_price=60_000, balances=BALANCES
        )
        for r in routes:
            if not r.direct:
                assert r.warning and "one-way" in r.warning

    def test_direct_balance_needs_no_transfer(self):
        routes = routes_for_award(
            target_program="Amex MR", points_price=10_000, balances=BALANCES
        )
        direct = [r for r in routes if r.direct]
        assert direct and direct[0].warning is None

    def test_no_target_program_yields_nothing(self):
        assert routes_for_award(target_program=None, points_price=60_000, balances=BALANCES) == []

    def test_unreachable_partner_yields_nothing(self):
        assert routes_for_award(
            target_program="Fictional Air", points_price=1000, balances=BALANCES
        ) == []


class TestCashVerdict:
    def test_affordable_reports_what_is_left(self):
        v = judge_cash(1402.0, 5000.0)
        assert v.affordable is True
        assert "3,598" in v.summary

    def test_unaffordable_reports_the_gap(self):
        v = judge_cash(5000.0, 1402.0)
        assert v.affordable is False
        assert "3,598" in v.summary

    def test_exactly_affordable_counts_as_affordable(self):
        assert judge_cash(1000.0, 1000.0).affordable is True


class TestSpendItAdvice:
    def test_southwest_is_told_to_spend(self):
        advice = spend_it_advice("SW RR", 96_638)
        assert advice and "can't be transferred" in advice

    def test_transferable_is_warned_about_one_way_transfers(self):
        advice = spend_it_advice("Amex MR", 219_662)
        assert advice and "one-way" in advice

    def test_zero_balance_non_transferable_says_nothing_urgent(self):
        assert spend_it_advice("SW RR", 0) is None


class TestOptionRanking:
    """The board ranks by true cost, so an award and a cash quote compare directly."""

    def _opt(self, **kw):
        from app.api.travel import OptionOut
        import uuid as _u
        base = dict(
            id=_u.uuid4(), leg_id=_u.uuid4(), source="manual_cash", label=None,
            cash_price=None, points_price=None, program=None, fees=0.0, url=None,
            quoted_on=None, is_selected=False, notes=None,
        )
        base.update(kw)
        o = OptionOut(**base)
        o.true_cost = true_cost(o.cash_price, o.points_price, o.program, o.fees)
        return o

    def test_cheapest_true_cost_wins(self):
        from app.api.travel import _rank

        award = self._opt(points_price=60_000, program="Amex MR", fees=89.0)  # $1,289
        costco = self._opt(cash_price=1402.0)
        cash = self._opt(cash_price=1479.0)
        ranked = _rank([cash, costco, award])
        assert ranked[0] is award
        assert ranked[0].is_best is True
        assert sum(o.is_best for o in ranked) == 1

    def test_unpriced_options_sink_but_survive(self):
        from app.api.travel import _rank

        priced = self._opt(cash_price=500.0)
        unpriced = self._opt()
        ranked = _rank([unpriced, priced])
        assert ranked[0] is priced
        assert unpriced in ranked          # kept, not dropped
        assert unpriced.is_best is False

    def test_all_unpriced_marks_nothing_best(self):
        from app.api.travel import _rank

        ranked = _rank([self._opt(), self._opt()])
        assert not any(o.is_best for o in ranked)

    def test_a_cheap_award_in_a_weak_currency_can_still_win(self):
        from app.api.travel import _rank

        # 60k SW RR at 1.4¢ = $840 — genuinely cheaper than a $900 cash fare.
        sw = self._opt(points_price=60_000, program="SW RR")
        cash = self._opt(cash_price=900.0)
        assert _rank([cash, sw])[0] is sw
