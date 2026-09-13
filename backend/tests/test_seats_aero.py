"""seats.aero connector — parsing, programme mapping, and coverage honesty.

The load-bearing piece is SOURCE_TO_PROGRAM: seats.aero prices an award in a mileage
programme, a balance is held in a transferable currency, and mapping one to the other
is what lets the planner say which of your points reach a given award.
"""
import pytest

from app.travel.connector_seats import (
    CABINS,
    SOURCE_TO_PROGRAM,
    SeatsAeroConnector,
    _num,
    _parse_row,
    get_connector,
)
from app.travel.transfer_partners import has_transfer_data


def _row(**over):
    base = {
        "Source": "aeroplan",
        "Route": {"OriginAirport": "LAX", "DestinationAirport": "LIS"},
        "ParsedDate": "2027-03-14",
        "YAvailable": True, "YMileageCost": "60000", "YTotalTaxes": 8900,
        "YDirect": True, "YRemainingSeats": 4, "YAirlines": "Air Canada",
        "TaxesCurrency": "USD",
    }
    base.update(over)
    return base


class TestGracefulSkip:
    def test_no_key_returns_none(self, monkeypatch):
        from app.config import settings
        monkeypatch.setattr(settings, "seats_aero_api_key", "", raising=False)
        assert get_connector() is None

    def test_key_builds_a_connector(self, monkeypatch):
        from app.config import settings
        monkeypatch.setattr(settings, "seats_aero_api_key", "k", raising=False)
        assert isinstance(get_connector(), SeatsAeroConnector)

    def test_trailing_slash_normalised(self):
        c = SeatsAeroConnector("k", "https://seats.aero/partnerapi/")
        assert c._base_url == "https://seats.aero/partnerapi"


class TestNum:
    def test_string_mileage_parsed(self):
        assert _num("60000") == 60000.0

    def test_zero_means_no_price(self):
        # seats.aero uses 0 and "" interchangeably for "not available".
        assert _num("0") is None
        assert _num(0) is None

    def test_empty_and_none(self):
        assert _num("") is None
        assert _num(None) is None

    def test_garbage_is_none_not_an_exception(self):
        assert _num("n/a") is None


class TestParseRow:
    def test_economy_award_parsed(self):
        q = _parse_row(_row(), ["Y"])[0]
        assert q.program == "Air Canada Aeroplan"
        assert q.miles == 60000.0
        assert q.direct is True
        assert q.seats == 4

    def test_taxes_converted_from_cents(self):
        # 8900 minor units is $89.00, not $8,900.
        assert _parse_row(_row(), ["Y"])[0].taxes == 89.0

    def test_one_row_expands_per_available_cabin(self):
        row = _row(JAvailable=True, JMileageCost="140000", JTotalTaxes=12500, JDirect=False)
        quotes = _parse_row(row, ["Y", "J"])
        assert {q.cabin for q in quotes} == {"Y", "J"}
        assert next(q for q in quotes if q.cabin == "J").miles == 140000.0

    def test_unavailable_cabin_skipped(self):
        row = _row(JAvailable=False, JMileageCost="140000")
        assert [q.cabin for q in _parse_row(row, ["Y", "J"])] == ["Y"]

    def test_cabin_with_no_price_skipped(self):
        row = _row(JAvailable=True, JMileageCost="0")
        assert [q.cabin for q in _parse_row(row, ["Y", "J"])] == ["Y"]

    def test_unmapped_source_is_dropped(self):
        # An unmapped programme can't be matched to a balance, so showing it would
        # imply the user's points don't work when we simply don't know.
        assert _parse_row(_row(Source="somethingnew"), ["Y"]) == []

    def test_missing_route_does_not_crash(self):
        row = _row()
        del row["Route"]
        q = _parse_row(row, ["Y"])[0]
        assert q.origin is None and q.destination is None

    def test_non_dict_row_ignored(self):
        assert _parse_row("not a row", ["Y"]) == []

    def test_falls_back_to_date_when_parsed_date_missing(self):
        row = _row()
        del row["ParsedDate"]
        row["Date"] = "2027-03-14"
        assert _parse_row(row, ["Y"])[0].date == "2027-03-14"

    def test_label_describes_program_cabin_and_stops(self):
        q = _parse_row(_row(YDirect=False), ["Y"])[0]
        assert q.label == "Air Canada Aeroplan · Economy · connecting"


class TestProgrammeMapping:
    def test_every_mapped_name_is_non_empty(self):
        for slug, program in SOURCE_TO_PROGRAM.items():
            assert program and program.strip(), slug

    def test_mapping_has_no_duplicate_targets(self):
        # Two slugs mapping to one programme would merge distinct award currencies.
        values = list(SOURCE_TO_PROGRAM.values())
        assert len(values) == len(set(values))

    def test_core_programmes_reach_a_transfer_partner(self):
        # These are the ones a balance can actually get to; if the strings ever drift
        # apart, coverage silently reports "no route" for real, reachable awards.
        for slug in ("aeroplan", "united", "flyingblue", "virginatlantic", "turkish"):
            assert has_transfer_data(SOURCE_TO_PROGRAM[slug]), slug

    def test_cabins_cover_the_four_codes(self):
        assert set(CABINS) == {"Y", "W", "J", "F"}


class TestCoverageHonesty:
    """"No balance reaches Iberia" and "we have no Iberia data" must not look alike."""

    def test_known_programme_with_no_holding_is_a_real_no_route(self):
        from app.api.travel import _award_out
        from app.travel.connector_seats import AwardQuote

        q = AwardQuote(
            source="delta", program="Delta SkyMiles", cabin="Y", cabin_label="Economy",
            miles=50_000, taxes=5.6, taxes_currency="USD", date="2027-03-14",
            origin="LAX", destination="LIS", direct=True, seats=2, airlines="Delta",
        )
        # Delta is in the transfer table, but with no Amex balance nothing reaches it.
        out = _award_out(q, balances={"Chase UR": 100_000.0})
        assert out.coverage == "no_route"

    def test_unmapped_programme_reports_unknown_not_no_route(self):
        from app.api.travel import _award_out
        from app.travel.connector_seats import AwardQuote

        q = AwardQuote(
            source="qatar", program="Qatar Privilege Club", cabin="J",
            cabin_label="Business", miles=70_000, taxes=120.0, taxes_currency="USD",
            date="2027-03-14", origin="LAX", destination="DOH", direct=True,
            seats=2, airlines="Qatar",
        )
        out = _award_out(q, balances={"Amex MR": 219_662.0})
        assert out.coverage == "unknown"

    def test_sufficient_balance_is_covered(self):
        from app.api.travel import _award_out
        from app.travel.connector_seats import AwardQuote

        q = AwardQuote(
            source="aeroplan", program="Air Canada Aeroplan", cabin="Y",
            cabin_label="Economy", miles=60_000, taxes=89.0, taxes_currency="USD",
            date="2027-03-14", origin="LAX", destination="LIS", direct=True,
            seats=4, airlines="Air Canada",
        )
        out = _award_out(q, balances={"Amex MR": 219_662.0})
        assert out.coverage == "covered"
        assert out.best_program == "Amex MR"

    def test_insufficient_balance_reports_the_shortfall(self):
        from app.api.travel import _award_out
        from app.travel.connector_seats import AwardQuote

        q = AwardQuote(
            source="aeroplan", program="Air Canada Aeroplan", cabin="J",
            cabin_label="Business", miles=140_000, taxes=89.0, taxes_currency="USD",
            date="2027-03-14", origin="LAX", destination="LIS", direct=False,
            seats=2, airlines="Air Canada",
        )
        out = _award_out(q, balances={"Bilt Points": 46_670.0})
        assert out.coverage == "short"
        assert out.shortfall == pytest.approx(93_330.0)
