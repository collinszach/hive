# TESTING.md — Test Cases for Claude Code

## Critical Tests (Must Pass Before Deploying)

### Points Tracker Tests
These are the most important — wrong earn rates silently cost you money.

```python
# backend/tests/test_points_tracker.py

def test_amex_gold_restaurant():
    """Amex Gold earns 4x at restaurants."""
    result = get_best_card_for_purchase("Food & Drink", "Restaurant", 100.0)
    amex = next(r for r in result if r["card_slug"] == "amex_gold")
    assert amex["multiplier"] == 4.0
    assert amex["program"] == "Amex MR"
    assert amex["points_earned"] == 400

def test_chase_southwest_sw_flights():
    """Chase Southwest earns 3x ONLY on SW Flights subcategory, not generic Flights."""
    result_sw = get_best_card_for_purchase("Travel", "SW Flights", 200.0)
    sw_card = next(r for r in result_sw if r["card_slug"] == "chase_southwest")
    assert sw_card["multiplier"] == 3.0

    result_generic = get_best_card_for_purchase("Travel", "Flights", 200.0)
    sw_generic = next(r for r in result_generic if r["card_slug"] == "chase_southwest")
    assert sw_generic["multiplier"] == 2.0  # generic travel, not 3x

def test_venture_x_base_rate_everywhere():
    """Venture X earns 2x everywhere — best base rate."""
    result = get_best_card_for_purchase("Shopping", "General", 50.0)
    vx = next(r for r in result if r["card_slug"] == "venture_x")
    assert vx["multiplier"] == 2.0

    # All other cards should be 1x for general shopping
    for card in result:
        if card["card_slug"] != "venture_x":
            assert card["multiplier"] == 1.0

def test_wf_autograph_ev_charging():
    """WF Autograph earns 3x on EV charging."""
    result = get_best_card_for_purchase("Transportation", "EV Charging", 30.0)
    wf = next(r for r in result if r["card_slug"] == "wf_autograph")
    assert wf["multiplier"] == 3.0

def test_optimizer_returns_sorted_by_cpp():
    """Optimizer always returns cards sorted by effective CPP, best first."""
    result = get_best_card_for_purchase("Food & Drink", "Restaurant", 100.0)
    cpps = [r["effective_cpp"] for r in result]
    assert cpps == sorted(cpps, reverse=True)

def test_bilt_rent_earns_points():
    """Bilt earns 1x on rent — unique among cards."""
    result = get_best_card_for_purchase("Home", "Rent", 2000.0)
    bilt = next(r for r in result if r["card_slug"] == "bilt_blue")
    assert bilt["multiplier"] == 1.0
    # All other cards should be 1x base rate too, but Bilt is the ONLY one that
    # actually earns points on rent (no fee) — note this in test comment

def test_no_points_for_excluded_transactions(sample_venmo_transaction):
    """Venmo transactions earn 0 points."""
    result = compute_points_for_transaction(sample_venmo_transaction)
    assert result is None or result["points_earned"] == 0
```

### Categorizer Tests
```python
# backend/tests/test_categorizer.py

def test_southwest_airlines_is_sw_flights():
    """Southwest Airlines ALWAYS → SW Flights, never generic Flights."""
    category, subcategory, source = categorize_transaction("SOUTHWEST AIRLINES", {})
    assert category == "Travel"
    assert subcategory == "SW Flights"
    assert source == "sql_rule"

def test_southwest_case_insensitive():
    category, subcategory, _ = categorize_transaction("Southwest Airlines CO", {})
    assert subcategory == "SW Flights"

def test_venmo_is_transfer():
    category, subcategory, _ = categorize_transaction("Venmo payment", {})
    assert category == "Transfers"
    assert subcategory == "P2P"

def test_zelle_is_transfer():
    category, subcategory, _ = categorize_transaction("Zelle To John Smith", {})
    assert category == "Transfers"

def test_costco_is_groceries():
    """Costco is Groceries, not Shopping."""
    category, subcategory, _ = categorize_transaction("COSTCO WHSE #1234", {})
    assert category == "Groceries"
    assert subcategory == "In-Store"

def test_uber_eats_is_delivery():
    category, subcategory, _ = categorize_transaction("UBER* EATS", {})
    assert category == "Food & Drink"
    assert subcategory == "Delivery"

def test_uber_not_eats_is_rideshare():
    category, subcategory, _ = categorize_transaction("UBER TRIP", {})
    assert category == "Travel"
    assert subcategory == "Rideshare"

def test_delta_is_generic_flights_not_sw():
    category, subcategory, _ = categorize_transaction("DELTA AIR LINES", {})
    assert category == "Travel"
    assert subcategory == "Flights"
    assert subcategory != "SW Flights"
```

### Transfer Detector Tests
```python
# backend/tests/test_transfer_detector.py

@pytest.mark.parametrize("description,expected", [
    ("Venmo payment to Alex", True),
    ("ZELLE TRANSFER", True),
    ("Cash App payment", True),
    ("Paypal Transfer", True),
    ("STARBUCKS #1234", False),
    ("DELTA AIR LINES", False),
    ("WHOLE FOODS MARKET", False),
    ("SOUTHWEST AIRLINES", False),
])
def test_transfer_detection(description, expected):
    assert is_transfer(description, -50.0) == expected
```

### Deduplication Test
```python
# backend/tests/test_ingestion.py

def test_no_duplicate_transactions(db_session):
    """Same plaid_transaction_id cannot be inserted twice."""
    txn_data = {
        "transaction_id": "test-plaid-id-123",
        "amount": 50.0,
        "date": "2024-01-15",
        "name": "Starbucks",
        ...
    }
    
    # First upsert
    _upsert_transactions(db_session, account_id, [txn_data])
    count_after_first = db_session.query(Transaction).count()
    
    # Second upsert with same ID — should not create duplicate
    _upsert_transactions(db_session, account_id, [txn_data])
    count_after_second = db_session.query(Transaction).count()
    
    assert count_after_first == count_after_second

def test_modified_transaction_updates_amount(db_session):
    """Modified transactions update amount, not create duplicates."""
    txn_data = {"transaction_id": "test-id", "amount": 50.0, ...}
    _upsert_transactions(db_session, account_id, [txn_data])
    
    modified = {**txn_data, "amount": 75.0}
    _upsert_transactions(db_session, account_id, [modified])
    
    txn = db_session.query(Transaction).filter_by(plaid_transaction_id="test-id").one()
    assert txn.amount == 75.0
```

## Running Tests

```bash
# Run all tests
docker compose exec backend pytest

# Run with coverage
docker compose exec backend pytest --cov=app --cov-report=term-missing

# Run specific test file
docker compose exec backend pytest tests/test_points_tracker.py -v

# Run just critical tests
docker compose exec backend pytest tests/test_points_tracker.py tests/test_categorizer.py tests/test_transfer_detector.py -v
```
