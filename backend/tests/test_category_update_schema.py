"""Regression: the category-override request must accept a null/absent subcategory.

Requiring `subcategory: str` 422'd overrides to categories that have no subcategory,
which surfaced to users as "recategorize doesn't save" (clients revert on error).
"""
from app.api.transactions import CategoryUpdateRequest


def test_subcategory_optional_when_absent():
    m = CategoryUpdateRequest(category="Shopping")
    assert m.category == "Shopping"
    assert m.subcategory is None


def test_subcategory_accepts_explicit_null():
    m = CategoryUpdateRequest(category="Shopping", subcategory=None)
    assert m.subcategory is None


def test_subcategory_still_accepts_a_value():
    m = CategoryUpdateRequest(category="Food & Drink", subcategory="Restaurant")
    assert m.subcategory == "Restaurant"
