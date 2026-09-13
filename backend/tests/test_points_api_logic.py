"""
Tests for points API logic — date filtering, ledger enrichment mapping, balance upsert logic.
These test pure logic helpers extracted from the endpoint, not the DB calls themselves.
"""
from datetime import date, timedelta
import pytest

from app.points.tracker import EARN_RULES


# ---------------------------------------------------------------------------
# program → card_slug mapping (used by balance upsert)
# ---------------------------------------------------------------------------

def _build_program_to_card_slug() -> dict[str, str]:
    """Derives program→card_slug from EARN_RULES (first rule seen wins)."""
    mapping: dict[str, str] = {}
    for rule in EARN_RULES:
        if rule.program not in mapping:
            mapping[rule.program] = rule.card_slug
    return mapping


class TestProgramToCardSlugMapping:
    def test_all_programs_mapped(self):
        mapping = _build_program_to_card_slug()
        expected = {
            "Amex MR", "Chase UR", "SW RR",
            "Bilt Points", "Capital One Miles",
        }
        assert set(mapping.keys()) == expected

    def test_amex_mr_maps_to_amex_gold(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Amex MR"] == "amex_gold"

    def test_chase_ur_maps_to_chase_sapphire(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Chase UR"] == "chase_sapphire"

    def test_sw_rr_maps_to_chase_southwest(self):
        mapping = _build_program_to_card_slug()
        assert mapping["SW RR"] == "chase_southwest"

    def test_bilt_maps_to_bilt_blue(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Bilt Points"] == "bilt_blue"

    def test_capital_one_maps_to_venture_x(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Capital One Miles"] == "venture_x"


# ---------------------------------------------------------------------------
# days → cutoff date calculation
# ---------------------------------------------------------------------------

class TestDaysCutoff:
    def test_90_days_is_roughly_3_months(self):
        today = date.today()
        cutoff = today - timedelta(days=90)
        assert (today - cutoff).days == 90

    def test_365_days_is_one_year(self):
        today = date.today()
        cutoff = today - timedelta(days=365)
        assert (today - cutoff).days == 365

    def test_30_days(self):
        today = date.today()
        cutoff = today - timedelta(days=30)
        assert (today - cutoff).days == 30


# ---------------------------------------------------------------------------
# Rolled-forward balances
# ---------------------------------------------------------------------------

class TestBalanceRollForward:
    """A manual balance is a snapshot; the summary carries it forward by points
    earned since, so a months-old entry doesn't read as the current balance."""

    def _summary(self, **kw):
        """Build a ProgramSummary the way points_summary does, for one program."""
        from app.api.points import ProgramSummary
        from app.points.tracker import POINT_VALUES_CPP, REDEMPTION_THRESHOLDS

        program = kw["program"]
        manual = kw.get("manual")
        since = kw.get("since", 0.0)
        redeemed = kw.get("redeemed", 0.0)
        earned = kw.get("earned", 0.0)
        snapshot = kw.get("as_of")

        if manual is not None:
            current = max(0, int(round(manual + since - redeemed)))
            is_estimated = since > 0 or redeemed > 0
        else:
            current = None
            is_estimated = False

        balance_for_value = float(current) if current is not None else earned
        cpp = POINT_VALUES_CPP.get(program, 1.0)
        threshold = REDEMPTION_THRESHOLDS.get(program)
        return ProgramSummary(
            program=program,
            points_earned_90d=round(earned, 2),
            manual_balance=manual,
            estimated_value_dollars=round(balance_for_value * cpp / 100.0, 2),
            redemption_threshold=threshold,
            above_threshold=threshold is not None and balance_for_value >= threshold,
            balance_as_of=snapshot.isoformat() if snapshot else None,
            points_since_balance=round(since, 2),
            points_redeemed_since=round(redeemed, 2),
            current_balance=current,
            is_estimated=is_estimated,
        )

    def test_snapshot_is_carried_forward(self):
        # The real case: the Amex MR snapshot from 2026-04-28 plus the 11,461 points
        # earned strictly after it. (Note this is well short of the ledger's all-time
        # total for the program — that includes backfilled transactions dated on or
        # before the snapshot, which the snapshot already accounts for.)
        s = self._summary(program="Amex MR", manual=208_201, since=11_461.0,
                          as_of=date(2026, 4, 28))
        assert s.manual_balance == 208_201      # raw snapshot preserved
        assert s.current_balance == 219_662     # 208,201 + 11,461
        assert s.is_estimated is True
        assert s.balance_as_of == "2026-04-28"

    def test_value_uses_rolled_forward_balance(self):
        # Amex MR at 2.0 cpp: the extra 11,461 points is real money, ~$229.
        stale = self._summary(program="Amex MR", manual=208_201, since=0.0)
        rolled = self._summary(program="Amex MR", manual=208_201, since=11_461.0)
        assert rolled.estimated_value_dollars > stale.estimated_value_dollars
        assert rolled.estimated_value_dollars == round(219_662 * 2.0 / 100.0, 2)

    def test_fresh_snapshot_is_not_flagged_estimated(self):
        # Nothing earned since the snapshot — the number is exact, not carried.
        s = self._summary(program="Chase UR", manual=109_545, since=0.0)
        assert s.current_balance == 109_545
        assert s.is_estimated is False

    def test_no_snapshot_falls_back_to_ledger_earned(self):
        # Previous behaviour preserved: with nothing to roll forward from, the
        # window's earned points stand in and are not presented as a balance.
        s = self._summary(program="Bilt Points", manual=None, earned=70.0)
        assert s.current_balance is None
        assert s.manual_balance is None
        assert s.is_estimated is False
        assert s.estimated_value_dollars == round(70.0 * 2.1 / 100.0, 2)

    def test_roll_forward_can_cross_the_redemption_threshold(self):
        # The point of the fix: SW RR sits under 50k as a stale snapshot and over
        # it once carried forward, so the nudge finally fires.
        threshold = 50_000
        stale = self._summary(program="SW RR", manual=49_000, since=0.0)
        rolled = self._summary(program="SW RR", manual=49_000, since=2_244.0)
        assert stale.redemption_threshold == threshold
        assert stale.above_threshold is False
        assert rolled.above_threshold is True

    def test_threshold_is_populated_not_hardcoded_none(self):
        # Regression: these were hardcoded None/False, so the iOS redemption
        # nudge (which reads above_threshold) could never fire for any program.
        from app.points.tracker import REDEMPTION_THRESHOLDS

        for program, threshold in REDEMPTION_THRESHOLDS.items():
            s = self._summary(program=program, manual=threshold + 1, since=0.0)
            assert s.redemption_threshold == threshold
            assert s.above_threshold is True

    def test_summary_source_wires_the_real_fields(self):
        # Guard the endpoint itself against regressing to the hardcoded values.
        import inspect

        from app.api import points

        src = inspect.getsource(points.points_summary)
        assert "redemption_threshold=None" not in src
        assert "above_threshold=False" not in src
        assert "current_balance=current" in src


class TestRedemptionsReduceTheBalance:
    """Confirmed redemptions come off the roll-forward.

    Without this the balance only ever grows, and the ledger proves redemptions
    happen: $5.60 Qantas, $14.57 Etihad and $11.20 Southwest charges are award taxes
    on tickets whose fares were paid in points.
    """

    _summary = TestBalanceRollForward._summary

    def test_confirmed_redemption_is_subtracted(self):
        s = self._summary(program="Amex MR", manual=208_201, since=11_461.0,
                          redeemed=60_000.0, as_of=date(2026, 4, 28))
        assert s.current_balance == 159_662      # 208,201 + 11,461 − 60,000
        assert s.points_redeemed_since == 60_000.0

    def test_redemption_alone_marks_the_figure_estimated(self):
        # Even with nothing earned since, a redemption means it's been carried.
        s = self._summary(program="Chase UR", manual=109_545, since=0.0, redeemed=25_000.0)
        assert s.current_balance == 84_545
        assert s.is_estimated is True

    def test_balance_never_goes_negative(self):
        # An over-recorded redemption must not render as a negative balance.
        s = self._summary(program="SW RR", manual=10_000, since=0.0, redeemed=50_000.0)
        assert s.current_balance == 0

    def test_redemption_drops_value_and_the_nudge(self):
        # Spending past the threshold should stop saying "ready to redeem".
        before = self._summary(program="Amex MR", manual=208_201, since=0.0)
        after = self._summary(program="Amex MR", manual=208_201, since=0.0, redeemed=200_000.0)
        assert before.above_threshold is True
        assert after.above_threshold is False
        assert after.estimated_value_dollars < before.estimated_value_dollars

    def test_summary_source_subtracts_redemptions(self):
        # Guard the endpoint against the one-way regression.
        import inspect

        from app.api import points

        src = inspect.getsource(points.points_summary)
        assert "redeemed_by_program" in src
        assert "- redeemed" in src
