"""
Tests for the Stage 1 regex categorization rule engine.
Covers critical business rules (Southwest Airlines, Venmo exclusion, fast food).
Only Stage 1 is tested here — Stages 2 and 3 require external services.
"""
import pytest

from app.ml.categorizer import _categorize_with_rules


# ---------------------------------------------------------------------------
# Critical business rules
# ---------------------------------------------------------------------------

class TestCriticalRules:
    def test_southwest_airlines_is_sw_flights(self):
        """Southwest Airlines MUST map to 'SW Flights', not generic 'Flights'."""
        result = _categorize_with_rules("SOUTHWEST AIRLINES 123456")
        assert result is not None
        assert result == ("Travel", "SW Flights")

    def test_southwest_airline_singular(self):
        """Both 'Airline' and 'Airlines' forms must match."""
        result = _categorize_with_rules("Southwest Airline Purchase")
        assert result is not None
        assert result[1] == "SW Flights"

    def test_southwest_before_generic_flights(self):
        """Southwest rule must be checked BEFORE generic airline patterns."""
        # If ordering were wrong, Southwest could match the generic airline rule
        result = _categorize_with_rules("SOUTHWEST AIRLINES DALLAS TX")
        assert result == ("Travel", "SW Flights")

    def test_venmo_is_transfer_p2p(self):
        """Venmo must map to Transfers/P2P."""
        result = _categorize_with_rules("Venmo payment to friend")
        assert result == ("Transfers", "P2P")

    def test_zelle_is_transfer_p2p(self):
        result = _categorize_with_rules("ZELLE PAYMENT ZPN1234567")
        assert result == ("Transfers", "P2P")

    def test_cash_app_is_transfer_p2p(self):
        result = _categorize_with_rules("Cash App Transfer")
        assert result == ("Transfers", "P2P")

    def test_paypal_transfer_is_p2p(self):
        result = _categorize_with_rules("Paypal Transfer to John")
        assert result == ("Transfers", "P2P")

    def test_cashapp_no_space_is_p2p(self):
        result = _categorize_with_rules("CASHAPP PAYMENT")
        assert result == ("Transfers", "P2P")


# ---------------------------------------------------------------------------
# Airline rules
# ---------------------------------------------------------------------------

class TestAirlines:
    @pytest.mark.parametrize("description,expected_sub", [
        ("DELTA AIR LINES ATLGA", "Flights"),
        ("UNITED AIRLINES CHICAGO IL", "Flights"),
        ("AMERICAN AIRLINES", "Flights"),
        ("JETBLUE AIRWAYS", "Flights"),
        ("SPIRIT AIRLINES", "Flights"),
        ("FRONTIER AIRLINES", "Flights"),
        ("ALASKA AIRLINES SEA", "Flights"),
    ])
    def test_airlines_are_flights(self, description, expected_sub):
        result = _categorize_with_rules(description)
        assert result is not None
        assert result == ("Travel", expected_sub)


# ---------------------------------------------------------------------------
# Fast food chains
# ---------------------------------------------------------------------------

class TestFastFood:
    @pytest.mark.parametrize("description", [
        "MCDONALDS #1234",
        "BURGER KING 5678",
        "Wendy's Restaurant",
        "CHICK-FIL-A 00987",
        "SUBWAY SANDWICHES",
        "CHIPOTLE MEXICAN GRILL",
        "TACO BELL #234",
        "POPEYES CHICKEN",
        "KFC #5678",
        "FIVE GUYS BURGERS",
        "SHAKE SHACK NYC",
        "IN-N-OUT BURGER",
        "WHATABURGER #0456",
        "SONIC DRIVE-IN",
        "PANDA EXPRESS",
        "PANERA BREAD",
    ])
    def test_fast_food_chains(self, description):
        result = _categorize_with_rules(description)
        assert result is not None
        assert result == ("Food & Drink", "Fast Food"), f"Failed for: {description}"


# ---------------------------------------------------------------------------
# Coffee shops
# ---------------------------------------------------------------------------

class TestCoffee:
    @pytest.mark.parametrize("description", [
        "STARBUCKS #12345 SEATTLE WA",
        "DUNKIN DONUTS",
        "BLUE BOTTLE COFFEE NYC",
        "PHILZ COFFEE SF",
        "PEET'S COFFEE",
        "DUTCH BROS COFFEE",
    ])
    def test_coffee_shops(self, description):
        result = _categorize_with_rules(description)
        assert result == ("Food & Drink", "Coffee"), f"Failed for: {description}"


# ---------------------------------------------------------------------------
# Grocery stores
# ---------------------------------------------------------------------------

class TestGroceries:
    @pytest.mark.parametrize("description", [
        "WHOLE FOODS MARKET",
        "TRADER JOE'S #123",
        "KROGER GROCERY",
        "SAFEWAY #456",
        "HEB GROCERY TX",
        "PUBLIX SUPERMARKET",
        "WEGMANS FOOD MARKETS",
        "ALDI FOODS",
        "COSTCO WHOLESALE",
    ])
    def test_in_store_grocery(self, description):
        result = _categorize_with_rules(description)
        assert result == ("Groceries", "In-Store"), f"Failed for: {description}"

    @pytest.mark.parametrize("description", [
        "AMAZON FRESH DELIVERY",
        "WALMART GROCERY PICKUP",
        "SHIPT DELIVERY",
    ])
    def test_online_grocery(self, description):
        result = _categorize_with_rules(description)
        assert result == ("Groceries", "Online"), f"Failed for: {description}"


# ---------------------------------------------------------------------------
# Food delivery (distinct from grocery)
# ---------------------------------------------------------------------------

class TestFoodDelivery:
    @pytest.mark.parametrize("description", [
        "UBER EATS ORDER",
        "DOORDASH DELIVERY",
        "GRUBHUB ORDER",
        "POSTMATES",
        "SEAMLESS ORDER",
    ])
    def test_food_delivery(self, description):
        result = _categorize_with_rules(description)
        assert result == ("Food & Drink", "Delivery"), f"Failed for: {description}"


# ---------------------------------------------------------------------------
# Uber: rideshare vs. Uber Eats (must not be confused)
# ---------------------------------------------------------------------------

class TestUberDistinction:
    def test_uber_eats_is_delivery(self):
        result = _categorize_with_rules("UBER EATS ORDER #ABC")
        assert result == ("Food & Drink", "Delivery")

    def test_uber_non_eats_is_rideshare(self):
        result = _categorize_with_rules("UBER * TRIP NYC")
        assert result == ("Travel", "Rideshare")

    def test_lyft_is_rideshare(self):
        result = _categorize_with_rules("Lyft ride 123")
        assert result == ("Travel", "Rideshare")


# ---------------------------------------------------------------------------
# Streaming services
# ---------------------------------------------------------------------------

class TestStreaming:
    @pytest.mark.parametrize("description", [
        "NETFLIX.COM",
        "SPOTIFY USA",
        "HULU SUBSCRIPTION",
        "DISNEY+ MONTHLY",
        "HBO MAX",
        "APPLE.COM/BILL",
        "PEACOCK PREMIUM",
        "PARAMOUNT+",
        "YOUTUBE PREMIUM",
    ])
    def test_streaming_services(self, description):
        result = _categorize_with_rules(description)
        assert result == ("Entertainment", "Streaming"), f"Failed for: {description}"


# ---------------------------------------------------------------------------
# Amazon: must not be caught by Amazon Fresh rule
# ---------------------------------------------------------------------------

class TestAmazon:
    def test_amazon_com_is_shopping(self):
        result = _categorize_with_rules("AMAZON.COM AMZN.COM/BILL WA")
        assert result == ("Shopping", "Amazon")

    def test_amazon_mktp_is_shopping(self):
        result = _categorize_with_rules("AMAZON MKTP US*AB1234")
        assert result == ("Shopping", "Amazon")

    def test_amazon_fresh_is_online_grocery(self):
        """Amazon Fresh must hit Online Grocery BEFORE the generic Amazon rule."""
        result = _categorize_with_rules("AMAZON FRESH ORDER")
        assert result == ("Groceries", "Online")


# ---------------------------------------------------------------------------
# Transportation
# ---------------------------------------------------------------------------

class TestTransportation:
    def test_ev_charging(self):
        assert _categorize_with_rules("TESLA SUPERCHARGER") == ("Transportation", "EV Charging")
        assert _categorize_with_rules("CHARGEPOINT CHARGING") == ("Transportation", "EV Charging")
        assert _categorize_with_rules("ELECTRIFY AMERICA") == ("Transportation", "EV Charging")

    def test_gas_stations(self):
        assert _categorize_with_rules("SHELL OIL 12345") == ("Transportation", "Gas")
        assert _categorize_with_rules("CHEVRON STATION") == ("Transportation", "Gas")
        assert _categorize_with_rules("EXXONMOBIL") == ("Transportation", "Gas")

    def test_transit(self):
        assert _categorize_with_rules("MTA NYCT UNLIMITED") == ("Transportation", "Transit")
        assert _categorize_with_rules("BART TICKET") == ("Transportation", "Transit")
        assert _categorize_with_rules("CLIPPER CARD RELOAD") == ("Transportation", "Transit")

    def test_parking(self):
        assert _categorize_with_rules("SPOTHERO PARKING") == ("Transportation", "Parking")
        assert _categorize_with_rules("PARKMOBILE METER") == ("Transportation", "Parking")


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_case_insensitive(self):
        """Rules must match regardless of case."""
        assert _categorize_with_rules("southwest airlines") == ("Travel", "SW Flights")
        assert _categorize_with_rules("VENMO") == ("Transfers", "P2P")
        assert _categorize_with_rules("Starbucks") == ("Food & Drink", "Coffee")

    def test_no_match_returns_none(self):
        """Obscure description with no matching rule returns None (falls through to AI)."""
        result = _categorize_with_rules("XYZABC123 QWERTY")
        assert result is None

    def test_empty_string_returns_none(self):
        result = _categorize_with_rules("")
        assert result is None
