"""Apple StoreKit 2 server-side verification.

Wraps Apple's official `app-store-server-library` to verify the signed JWS that the
iOS app hands back after a purchase (StoreKit 2 `Transaction.jwsRepresentation`) and
the signed payloads Apple POSTs to our App Store Server Notifications V2 webhook.

Design mirrors `app.notifications.apns`: a module singleton with a `configured`
property so the rest of the app degrades gracefully (no crash, no fake entitlements)
when the library, the Apple root certs, or the env config are absent — e.g. in CI or
a dev box that never set `APPLE_ROOT_CA_DIR`.

The Apple root CA certs are *public* (download from
https://www.apple.com/certificateauthority/). Place the DER/`.cer` files in the
directory pointed to by `settings.apple_root_ca_dir`. AppleRootCA-G3 is the one that
roots the StoreKit JWS chain; including G2 as well is harmless.
"""
from __future__ import annotations

import glob
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import settings
from app.models.user import PlanTier

logger = logging.getLogger(__name__)

# Product IDs are defined in App Store Connect and MUST match the iOS app's
# IAPManager.productIDs. Each maps to the plan tier it unlocks.
PRODUCT_TIERS: dict[str, PlanTier] = {
    "com.zacharyjcollins.hive.starter.monthly": PlanTier.starter,
    "com.zacharyjcollins.hive.starter.annual": PlanTier.starter,
    "com.zacharyjcollins.hive.pro.monthly": PlanTier.pro,
    "com.zacharyjcollins.hive.pro.annual": PlanTier.pro,
}


def product_to_tier(product_id: str | None) -> PlanTier:
    """Map an App Store product id to the plan it grants (free if unknown)."""
    if not product_id:
        return PlanTier.free
    return PRODUCT_TIERS.get(product_id, PlanTier.free)


def ms_to_datetime(ms: int | None) -> Optional[datetime]:
    """Apple timestamps are epoch milliseconds; convert to tz-aware UTC."""
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)


class AppleIAPVerifier:
    """Lazy, fail-safe wrapper around `SignedDataVerifier`."""

    def __init__(self) -> None:
        self._verifier: Any = None
        self._loaded = False

    @property
    def configured(self) -> bool:
        return self._build() is not None

    def _load_root_certs(self) -> list[bytes]:
        directory = settings.apple_root_ca_dir
        if not directory or not os.path.isdir(directory):
            return []
        certs: list[bytes] = []
        patterns = ("*.cer", "*.der", "*.pem", "*.crt")
        for pattern in patterns:
            for path in sorted(glob.glob(os.path.join(directory, pattern))):
                try:
                    with open(path, "rb") as fh:
                        certs.append(fh.read())
                except OSError as exc:  # pragma: no cover - filesystem edge
                    logger.warning("Could not read Apple root cert %s: %s", path, exc)
        return certs

    def _build(self) -> Any:
        if self._loaded:
            return self._verifier
        self._loaded = True

        root_certs = self._load_root_certs()
        if not root_certs:
            logger.info("Apple IAP not configured: no root certs in apple_root_ca_dir")
            self._verifier = None
            return None

        try:
            from appstoreserverlibrary.signed_data_verifier import SignedDataVerifier
            from appstoreserverlibrary.models.Environment import Environment
        except ImportError:  # pragma: no cover - optional dependency
            logger.warning("app-store-server-library not installed; Apple IAP disabled")
            self._verifier = None
            return None

        env = (
            Environment.PRODUCTION
            if settings.apple_iap_environment.lower().startswith("prod")
            else Environment.SANDBOX
        )
        app_apple_id = settings.apple_iap_app_apple_id or None
        try:
            self._verifier = SignedDataVerifier(
                root_certs,
                settings.apple_iap_enable_online_checks,
                env,
                settings.apple_iap_bundle_id,
                app_apple_id,
            )
        except Exception as exc:  # pragma: no cover - misconfig
            logger.error("Failed to build Apple SignedDataVerifier: %s", exc)
            self._verifier = None
        return self._verifier

    def verify_transaction(self, signed_transaction: str) -> Any:
        """Verify a StoreKit 2 signed transaction JWS. Returns the decoded payload.

        Raises RuntimeError if unconfigured; re-raises the library's
        VerificationException on a bad/forged signature.
        """
        verifier = self._build()
        if verifier is None:
            raise RuntimeError("Apple IAP verifier is not configured")
        return verifier.verify_and_decode_signed_transaction(signed_transaction)

    def verify_notification(self, signed_payload: str) -> Any:
        """Verify an App Store Server Notification V2 signed payload."""
        verifier = self._build()
        if verifier is None:
            raise RuntimeError("Apple IAP verifier is not configured")
        return verifier.verify_and_decode_notification(signed_payload)


# Module singleton, mirrors apns_client.
apple_verifier = AppleIAPVerifier()
