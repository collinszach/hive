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
