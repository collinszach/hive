"""Amadeus Self-Service — live cash prices for flights.

The travel planner's job is ranking cash against points, and that needs a cash number.
Typing one in works, but a live quote makes cents-per-point automatic: the fare the
award replaces is the whole basis for judging whether a redemption is any good.

Entirely optional. ``get_connector()`` returns ``None`` when no credentials are set,
and every caller degrades to manual quotes — the same graceful-skip shape as
``snaptrade/connector.py`` and ``marketdata/connector.py``.

⚠️  Two things to know before trusting output:
  * The **test host** (the default) serves a limited, partly cached dataset. Prices
    there are illustrative, not real. Point ``AMADEUS_BASE_URL`` at the production
    host for numbers worth comparing against an award.
  * API shapes, quotas and free-tier limits change. Verify against Amadeus's current
    docs rather than assuming this module is still correct.
"""
import logging
import time
from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Tokens are valid for ~30 minutes; refresh a little early rather than racing expiry.
_TOKEN_SKEW_SECONDS = 60
_MAX_RETRIES = 3
_BACKOFF_BASE_SECONDS = 1.5


@dataclass(frozen=True)
class FlightQuote:
    """One priced itinerary, flattened to what the comparison board needs."""
    price: float
    currency: str
    carrier: Optional[str]
    departure: Optional[str]      # ISO datetime of the first segment
    arrival: Optional[str]        # ISO datetime of the last segment
    stops: int
    duration: Optional[str]       # ISO-8601 duration, e.g. "PT11H25M"

    @property
    def label(self) -> str:
        who = self.carrier or "Flight"
        how = "nonstop" if self.stops == 0 else f"{self.stops} stop{'s' if self.stops > 1 else ''}"
        return f"{who} · {how}"


class AmadeusError(RuntimeError):
    """A call failed in a way the caller should surface rather than swallow."""


class AmadeusConnector:
    def __init__(self, client_id: str, client_secret: str, base_url: str,
                 *, timeout: float = 20.0) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    @property
    def is_test_host(self) -> bool:
        """Test data is illustrative — callers should say so rather than imply live pricing."""
        return "test.api.amadeus.com" in self._base_url

    # -- auth -----------------------------------------------------------------

    def _access_token(self) -> str:
        """Cached OAuth2 client-credentials token, refreshed just before expiry."""
        if self._token and time.time() < self._token_expires_at:
            return self._token

        try:
            resp = httpx.post(
                f"{self._base_url}/v1/security/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise AmadeusError(f"Could not reach Amadeus: {exc}") from exc

        if resp.status_code != 200:
            # Never echo the body — it can contain the client id.
            raise AmadeusError(f"Amadeus rejected the credentials (HTTP {resp.status_code})")

        payload = resp.json()
        self._token = payload.get("access_token")
        if not self._token:
            raise AmadeusError("Amadeus returned no access token")
        self._token_expires_at = time.time() + max(
            0, int(payload.get("expires_in", 1799)) - _TOKEN_SKEW_SECONDS
        )
        return self._token

    # -- http -----------------------------------------------------------------

    def _get(self, path: str, params: dict) -> dict:
        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = httpx.get(
                    f"{self._base_url}{path}",
                    params=params,
                    headers={"Authorization": f"Bearer {self._access_token()}"},
                    timeout=self._timeout,
                )
            except httpx.HTTPError as exc:
                last_exc = exc
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** attempt))
                continue

            if resp.status_code == 429:
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** attempt))
                continue
            if resp.status_code == 401:
                # Token expired early — drop it and let the next attempt re-auth.
                self._token = None
                self._token_expires_at = 0.0
                continue
            if resp.status_code >= 400:
                raise AmadeusError(f"Amadeus search failed (HTTP {resp.status_code})")
            return resp.json()

        raise AmadeusError(f"Amadeus unreachable after {_MAX_RETRIES} attempts: {last_exc}")

    # -- searches -------------------------------------------------------------

    def search_flights(
        self,
        *,
        origin: str,
        destination: str,
        departure: date,
        adults: int = 1,
        currency: str = "USD",
        max_results: int = 5,
    ) -> list[FlightQuote]:
        """Cheapest one-way cash offers for a route and date.

        One-way on purpose: the planner models a trip as independent legs, so a
        round-trip price couldn't be attributed to either of them.
        """
        payload = self._get("/v2/shopping/flight-offers", {
            "originLocationCode": origin.strip().upper(),
            "destinationLocationCode": destination.strip().upper(),
            "departureDate": departure.isoformat(),
            "adults": adults,
            "currencyCode": currency,
            "max": max_results,
        })
        return [q for q in (_parse_offer(o) for o in payload.get("data", [])) if q]


def _parse_offer(offer: dict) -> Optional[FlightQuote]:
    """Flatten one Amadeus offer. Returns None if it lacks a usable price.

    Defensive throughout: a partially-shaped offer should drop out of the list, not
    break the whole search.
    """
    try:
        price = float(offer["price"]["grandTotal"])
    except (KeyError, TypeError, ValueError):
        return None

    currency = (offer.get("price") or {}).get("currency") or "USD"
    itineraries = offer.get("itineraries") or []
    segments = (itineraries[0].get("segments") or []) if itineraries else []

    carrier = None
    departure = arrival = None
    if segments:
        carrier = segments[0].get("carrierCode")
        departure = (segments[0].get("departure") or {}).get("at")
        arrival = (segments[-1].get("arrival") or {}).get("at")

    return FlightQuote(
        price=round(price, 2),
        currency=currency,
        carrier=carrier,
        departure=departure,
        arrival=arrival,
        stops=max(0, len(segments) - 1),
        duration=(itineraries[0].get("duration") if itineraries else None),
    )


def get_connector() -> Optional[AmadeusConnector]:
    """A configured connector, or None when credentials aren't set."""
    from app.config import settings
    if not settings.amadeus_client_id or not settings.amadeus_client_secret:
        return None
    return AmadeusConnector(
        client_id=settings.amadeus_client_id,
        client_secret=settings.amadeus_client_secret,
        base_url=settings.amadeus_base_url,
    )
