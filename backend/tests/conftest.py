"""Shared pytest configuration and fixtures."""
import os

import pytest


def pytest_configure(config):
    """Set required environment variables for tests that import app modules."""
    os.environ.setdefault("POSTGRES_PASSWORD", "test")
    os.environ.setdefault("FERNET_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")


def require_disposable_db(engine) -> None:
    """Guard: refuse to run a destructive (TRUNCATE/create_all) integration test unless the
    target database is clearly disposable.

    Integration fixtures connect to ``settings.database_sync_url`` — which in a deployed
    container is the **production** database. Running such a suite there silently wipes real
    data (this exact footgun erased live paper-trading data once). A database is considered
    disposable only if its name contains ``test`` or ``HIVE_ALLOW_DB_TESTS=1`` is set to
    explicitly opt in. Otherwise the test is skipped, never destructive.
    """
    db_name = (engine.url.database or "").lower()
    if "test" in db_name or os.environ.get("HIVE_ALLOW_DB_TESTS") == "1":
        return
    pytest.skip(
        f"refusing to run destructive integration test against non-test database "
        f"{engine.url.database!r}; use a *_test database or set HIVE_ALLOW_DB_TESTS=1"
    )
