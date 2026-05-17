"""Unit tests for Google OAuth find-or-create account logic."""
import pytest
from app.api.auth_google import _derive_username


class TestDeriveUsername:
    def test_extracts_local_part_of_email(self):
        assert _derive_username("zach@gmail.com", set()) == "zach"

    def test_strips_non_alphanumeric(self):
        assert _derive_username("zach.collins+test@gmail.com", set()) == "zachcollinstest"

    def test_appends_number_on_collision(self):
        assert _derive_username("zach@gmail.com", {"zach"}) == "zach2"

    def test_appends_incrementing_number(self):
        assert _derive_username("zach@gmail.com", {"zach", "zach2"}) == "zach3"

    def test_falls_back_to_user_prefix(self):
        result = _derive_username("@gmail.com", set())
        assert result.startswith("user")

    def test_truncates_to_32_chars(self):
        long_email = "averylongemaillocalpart123456789@example.com"
        result = _derive_username(long_email, set())
        assert len(result) <= 32
