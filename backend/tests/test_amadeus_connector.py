"""Amadeus connector — parsing and graceful degradation.

The planner must stay fully usable without credentials and must not break on a
partially-shaped offer, so these cover the skip path and the defensive parsing rather
than making any network call.
"""
import pytest

from app.travel.connector_amadeus import (
    AmadeusConnector,
    FlightQuote,
    _parse_offer,
    get_connector,
)


def _offer(total="1479.00", currency="USD", segments=None, duration="PT11H25M"):
    if segments is None:
        segments = [{
            "carrierCode": "TP",
            "departure": {"at": "2027-03-14T10:15:00"},
            "arrival": {"at": "2027-03-14T22:40:00"},
        }]
    return {
        "price": {"grandTotal": total, "currency": currency},
        "itineraries": [{"duration": duration, "segments": segments}],
    }


class TestGracefulSkip:
    def test_no_credentials_returns_none(self, monkeypatch):
        # The planner works on manual quotes; a missing key is a missing capability,
        # not an error, so nothing should raise.
        from app.config import settings
        monkeypatch.setattr(settings, "amadeus_client_id", "", raising=False)
        monkeypatch.setattr(settings, "amadeus_client_secret", "", raising=False)
        assert get_connector() is None

    def test_partial_credentials_still_skips(self, monkeypatch):
        from app.config import settings
        monkeypatch.setattr(settings, "amadeus_client_id", "abc", raising=False)
        monkeypatch.setattr(settings, "amadeus_client_secret", "", raising=False)
        assert get_connector() is None

    def test_both_credentials_builds_a_connector(self, monkeypatch):
        from app.config import settings
        monkeypatch.setattr(settings, "amadeus_client_id", "abc", raising=False)
        monkeypatch.setattr(settings, "amadeus_client_secret", "xyz", raising=False)
        assert isinstance(get_connector(), AmadeusConnector)


class TestTestHostFlag:
    def test_default_host_is_flagged_as_test(self):
        # Test data is cached and illustrative; the UI has to be able to say so.
        c = AmadeusConnector("a", "b", "https://test.api.amadeus.com")
        assert c.is_test_host is True

    def test_production_host_is_not(self):
        c = AmadeusConnector("a", "b", "https://api.amadeus.com")
        assert c.is_test_host is False

    def test_trailing_slash_is_normalised(self):
        c = AmadeusConnector("a", "b", "https://api.amadeus.com/")
        assert c._base_url == "https://api.amadeus.com"


class TestParseOffer:
    def test_extracts_price_and_currency(self):
        q = _parse_offer(_offer(total="1479.00"))
        assert q.price == 1479.0
        assert q.currency == "USD"

    def test_nonstop_has_zero_stops(self):
        assert _parse_offer(_offer()).stops == 0

    def test_two_segments_is_one_stop(self):
        segs = [
            {"carrierCode": "UA", "departure": {"at": "x"}, "arrival": {"at": "y"}},
            {"carrierCode": "UA", "departure": {"at": "y"}, "arrival": {"at": "z"}},
        ]
        assert _parse_offer(_offer(segments=segs)).stops == 1

    def test_arrival_comes_from_the_last_segment(self):
        segs = [
            {"carrierCode": "UA", "departure": {"at": "A"}, "arrival": {"at": "B"}},
            {"carrierCode": "UA", "departure": {"at": "B"}, "arrival": {"at": "FINAL"}},
        ]
        assert _parse_offer(_offer(segments=segs)).arrival == "FINAL"

    def test_missing_price_drops_the_offer(self):
        # One malformed offer must not break the whole search.
        assert _parse_offer({"itineraries": []}) is None

    def test_non_numeric_price_drops_the_offer(self):
        assert _parse_offer(_offer(total="not-a-number")) is None

    def test_missing_itineraries_still_yields_a_price(self):
        q = _parse_offer({"price": {"grandTotal": "500.00", "currency": "USD"}})
        assert q is not None and q.price == 500.0 and q.stops == 0

    def test_missing_currency_defaults_to_usd(self):
        q = _parse_offer({"price": {"grandTotal": "500.00"}})
        assert q.currency == "USD"

    def test_empty_segments_do_not_crash(self):
        q = _parse_offer(_offer(segments=[]))
        assert q is not None and q.carrier is None and q.stops == 0


class TestLabel:
    def test_nonstop_label(self):
        q = FlightQuote(500.0, "USD", "TP", None, None, 0, None)
        assert q.label == "TP · nonstop"

    def test_single_stop_is_singular(self):
        q = FlightQuote(500.0, "USD", "UA", None, None, 1, None)
        assert q.label == "UA · 1 stop"

    def test_multiple_stops_are_plural(self):
        q = FlightQuote(500.0, "USD", "UA", None, None, 2, None)
        assert q.label == "UA · 2 stops"

    def test_unknown_carrier_still_labels(self):
        q = FlightQuote(500.0, "USD", None, None, None, 0, None)
        assert q.label == "Flight · nonstop"


class TestSearchIsCashOnly:
    def test_a_live_quote_becomes_a_cash_option(self):
        """A fetched fare has no points price, so it must read as a cash option.

        That's what lets it act as the benchmark an award is judged against.
        """
        from app.travel.valuation import judge, true_cost

        v = judge(1479.0, None, None)
        assert v.rating == "cash"
        assert true_cost(1479.0, None, None) == 1479.0
