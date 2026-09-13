"""Award-redemption detection from the transaction feed.

An award booking pays the fare in points, so only taxes and fees reach the card. That
small airline charge is the only trace, and without catching it a displayed balance
drifts upward forever. Cases here are taken from the live ledger.
"""
import pytest

from app.points.redemption_detector import (
    AWARD_FEE_MAX,
    REASON_RANK,
    TSA_SEGMENT_FEE,
    classify_award_fee,
    explain,
)


def _c(merchant, desc, amount, category="Travel", subcategory="Flights"):
    return classify_award_fee(
        merchant=merchant, raw_description=desc, amount=amount,
        category=category, subcategory=subcategory,
    )


class TestRealLedgerRows:
    """The three charges that prompted this feature, plus the ones nearby."""

    def test_qantas_5_60_is_one_security_fee(self):
        # $5.60 from Qantas is not a Qantas ticket — it's the US 9/11 fee on an award.
        assert _c("Qantas", "QANTAS MASCOT AU", 5.60) == "tsa_segment_fee"

    def test_southwest_11_20_is_two_segments(self):
        assert _c("Southwest", "SOUTHWES 5262187727698", 11.20) == "tsa_segment_fee"

    def test_etihad_14_57_is_a_small_airline_charge(self):
        assert _c("Etihad Airways", "ETIHAD AIRWAYS NEW YORK", 14.57) == "small_airline_charge"

    def test_avianca_cash_fare_is_not_flagged(self):
        # $1,693 is a fare. Flagging it would make the queue useless.
        assert _c("Avianca", "AVIANCA SAN JOSE SA", 1693.29) is None

    def test_priority_pass_is_not_a_redemption(self):
        # A lounge membership is a small travel charge but never an award tax.
        assert _c("Priority Pass", "Priority Pass", 35.00) is None


class TestSecurityFeeMultiples:
    @pytest.mark.parametrize("segments", range(1, 9))
    def test_exact_multiples_detected(self, segments):
        amount = round(TSA_SEGMENT_FEE * segments, 2)
        assert _c("United", "UNITED AIRLINES", amount) == "tsa_segment_fee"

    def test_near_miss_is_only_a_small_charge(self):
        # 5.61 is not the security fee; don't claim the strongest reason for it.
        assert _c("United", "UNITED AIRLINES", 5.61) == "small_airline_charge"

    def test_beyond_eight_segments_is_not_claimed_as_tsa(self):
        # 9 × 5.60 = 50.40. Plausible as something else; don't over-claim.
        assert _c("United", "UNITED AIRLINES", 50.40) == "small_airline_charge"


class TestBoundaries:
    def test_refunds_are_not_redemptions(self):
        assert _c("United", "UNITED AIRLINES", -5.60) is None

    def test_zero_is_not_a_redemption(self):
        assert _c("United", "UNITED AIRLINES", 0.0) is None

    def test_above_the_ceiling_is_a_fare(self):
        assert _c("United", "UNITED AIRLINES", AWARD_FEE_MAX + 0.01) is None

    def test_at_the_ceiling_still_counts(self):
        assert _c("United", "UNITED AIRLINES", AWARD_FEE_MAX) == "small_airline_charge"

    def test_empty_description_is_ignored(self):
        assert _c(None, None, 5.60) is None
        assert _c("", "  ", 5.60) is None


class TestExclusions:
    @pytest.mark.parametrize("desc", [
        "PRIORITY PASS", "CLEAR ME", "TSA PRECHECK", "GLOBAL ENTRY",
        "DELTA WIFI", "UNITED BAGGAGE FEE", "AA SEAT FEE",
        "AIRPORT PARKING", "TRIP INSURANCE",
    ])
    def test_known_non_award_travel_charges(self, desc):
        assert _c(None, desc, 12.00) is None

    def test_exclusion_beats_a_perfect_fee_multiple(self):
        # Even at exactly $5.60, in-flight wifi is not an award booking.
        assert _c("Delta", "DELTA WIFI GOGO INFLIGHT", 5.60) is None


class TestMerchantMatching:
    def test_unlisted_airline_still_caught_via_subcategory(self):
        # The airline list can't be exhaustive; the categoriser already did the work.
        assert _c("Obscure Air", "OBSCURE AIR CO", 9.20, subcategory="Flights") \
            == "small_airline_charge"

    def test_hotel_points_stay(self):
        assert _c("Hyatt", "HYATT REGENCY", 28.00, subcategory="Hotel") \
            == "small_hotel_charge"

    def test_non_travel_small_charge_ignored(self):
        # A $5.60 coffee is not an award booking.
        assert _c("Starbucks", "STARBUCKS #123", 5.60,
                  category="Food & Drink", subcategory="Coffee") is None

    def test_hotel_fee_multiple_is_not_called_a_segment_fee(self):
        # The security fee is an airline concept; a $11.20 hotel charge isn't it.
        assert _c("Hilton", "HILTON GARDEN INN", 11.20, subcategory="Hotel") \
            == "small_hotel_charge"


class TestExplain:
    def test_singular_and_plural_legs(self):
        assert "1 leg)" in explain("tsa_segment_fee", 5.60)
        assert "2 legs)" in explain("tsa_segment_fee", 11.20)

    def test_every_reason_has_an_explanation(self):
        for reason in REASON_RANK:
            assert explain(reason, 10.0), f"{reason} has no explanation"

    def test_unknown_reason_is_blank_not_an_error(self):
        assert explain(None, 10.0) == ""
