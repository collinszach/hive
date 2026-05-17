"""Shared pytest configuration and fixtures."""
import os


def pytest_configure(config):
    """Set required environment variables for tests that import app modules."""
    os.environ.setdefault("POSTGRES_PASSWORD", "test")
    os.environ.setdefault("FERNET_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")
