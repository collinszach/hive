"""Application-level field encryption using Fernet symmetric encryption.

Used to encrypt sensitive fields (Plaid access tokens) at rest in the database.
The encryption key is loaded from the FERNET_KEY environment variable.
"""
import logging

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import String, TypeDecorator

from app.config import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    if not settings.fernet_key:
        raise RuntimeError("FERNET_KEY is not set — cannot encrypt/decrypt access tokens")
    return Fernet(settings.fernet_key.encode())


def encrypt(plaintext: str) -> str:
    """Encrypt a string. Returns a base64-encoded ciphertext string."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted string. Raises InvalidToken if tampered."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        logger.error("Failed to decrypt field — key mismatch or data corruption")
        raise


class EncryptedString(TypeDecorator):
    """SQLAlchemy column type that transparently encrypts/decrypts on read/write."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        # Don't double-encrypt if already encrypted (starts with gAAA = Fernet prefix)
        if value.startswith("gAAA"):
            return value
        return encrypt(value)

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        # If not encrypted (e.g. old plaintext rows), return as-is
        if not value.startswith("gAAA"):
            logger.warning("Decrypting unencrypted value — run migration to encrypt all tokens")
            return value
        return decrypt(value)
