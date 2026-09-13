"""seats.aero — award availability across mileage programs.

The one question a points balance actually raises is *where can I go with it*, and no
cash-fare API can answer it. seats.aero aggregates award space across programmes, which
makes it the only realistic source for this.

Paid, and entirely optional: ``get_connector()`` returns ``None`` with no key and every
caller degrades to manual quotes — the same graceful-skip shape as the Amadeus and
SnapTrade connectors.

The load-bearing part of this module is :data:`SOURCE_TO_PROGRAM`. seats.aero prices an
award in a *mileage programme* ("aeroplan"), while a balance is held in a *transferable
currency* ("Amex MR"). Mapping one to the other is what lets the planner say which of
your balances can reach a given award — get the mapping wrong and coverage silently
reads as "none of your points work here".

⚠️  Verify against the current Partner API docs before trusting this. Field names,
sources and quotas change, and my knowledge of them has a cutoff.
"""
import logging
import time
from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_BACKOFF_BASE_SECONDS = 1.5

# seats.aero source slug → the programme name used in transfer_partners.py.
# These strings must match TRANSFER_PARTNERS.to_partner or coverage lookups miss.
SOURCE_TO_PROGRAM: dict[str, str] = {
    "aeroplan": "Air Canada Aeroplan",
    "united": "United MileagePlus",
    "american": "American AAdvantage",
    "alaska": "Alaska Mileage Plan",
    "delta": "Delta SkyMiles",
    "jetblue": "JetBlue TrueBlue",
    "southwest": "Southwest Rapid Rewards",
    "virginatlantic": "Virgin Atlantic Flying Club",
    "flyingblue": "Air France/KLM Flying Blue",
    "emirates": "Emirates Skywards",
    "etihad": "Etihad Guest",
    "qatar": "Qatar Privilege Club",
    "qantas": "Qantas Frequent Flyer",
    "singapore": "Singapore KrisFlyer",
    "turkish": "Turkish Miles&Smiles",
    "lifemiles": "Avianca LifeMiles",
    "smiles": "GOL Smiles",
    "azul": "Azul TudoAzul",
    "velocity": "Virgin Australia Velocity",
    "connectmiles": "Copa ConnectMiles",
    "eurobonus": "SAS EuroBonus",
    "finnair": "Finnair Plus",
    "iberia": "Iberia Plus",
    "britishairways": "British Airways Avios",
}

# Cabin codes seats.aero prefixes its fields with.
CABINS = {"Y": "Economy", "W": "Premium", "J": "Business", "F": "First"}


@dataclass(frozen=True)
class AwardQuote:
    """One award seat, flattened to what the comparison board needs."""
    source: str                  # seats.aero slug
    program: str                 # the programme a balance would have to reach
    cabin: str                   # "Y" | "W" | "J" | "F"
    cabin_label: str
    miles: float
    taxes: float
    taxes_currency: str
    date: Optional[str]
    origin: Optional[str]
    destination: Optional[str]
    direct: bool
    seats: Optional[int]
    airlines: Optional[str]

    @property
    def label(self) -> str:
        how = "nonstop" if self.direct else "connecting"
        return f"{self.program} · {self.cabin_label} · {how}"


class SeatsAeroError(RuntimeError):
    """A call failed in a way the caller should surface rather than swallow."""


class SeatsAeroConnector:
    def __init__(self, api_key: str, base_url: str, *, timeout: float = 25.0) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    def _get(self, path: str, params: dict) -> dict:
        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = httpx.get(
                    f"{self._base_url}{path}",
                    params=params,
                    headers={
                        "Partner-Authorization": self._api_key,
                        "Accept": "application/json",
                    },
                    timeout=self._timeout,
                )
            except httpx.HTTPError as exc:
                last_exc = exc
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** attempt))
                continue

            if resp.status_code == 429:
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** attempt))
                continue
            if resp.status_code in (401, 403):
                raise SeatsAeroError("seats.aero rejected the API key")
            if resp.status_code >= 400:
                raise SeatsAeroError(f"seats.aero search failed (HTTP {resp.status_code})")
            return resp.json()

        raise SeatsAeroError(f"seats.aero unreachable after {_MAX_RETRIES} attempts: {last_exc}")

    def search_awards(
        self,
        *,
        origin: str,
        destination: str,
        start: date,
        end: Optional[date] = None,
        cabins: Optional[list[str]] = None,
        take: int = 25,
    ) -> list[AwardQuote]:
        """Award space on a route over a date range, cheapest cabin-price first.

        A single row can carry a price for several cabins at once, so one result may
        expand into multiple quotes — one per cabin that's actually available.
        """
        payload = self._get("/search", {
            "origin_airport": origin.strip().upper(),
            "destination_airport": destination.strip().upper(),
            "start_date": start.isoformat(),
            "end_date": (end or start).isoformat(),
            "take": take,
        })

        wanted = [c.upper() for c in (cabins or list(CABINS))]
        quotes: list[AwardQuote] = []
        for row in payload.get("data", []) or []:
            quotes.extend(q for q in _parse_row(row, wanted) if q)
        quotes.sort(key=lambda q: q.miles)
        return quotes


def _num(value) -> Optional[float]:
    """seats.aero returns mileage costs as strings; empty and 0 both mean 'no price'."""
    if value in (None, "", "0"):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _parse_row(row: dict, wanted: list[str]) -> list[AwardQuote]:
    """Expand one availability row into a quote per available cabin.

    Defensive throughout: a partially-shaped row should drop out rather than break the
    whole search.
    """
    if not isinstance(row, dict):
        return []

    source = (row.get("Source") or "").strip().lower()
    program = SOURCE_TO_PROGRAM.get(source)
    if not program:
        # An unmapped programme can't be matched to a balance, so it would show as
        # uncoverable. Better to drop it than to imply your points don't work.
        logger.debug("seats.aero source %r has no programme mapping", source)
        return []

    route = row.get("Route") or {}
    origin = route.get("OriginAirport")
    destination = route.get("DestinationAirport")
    when = row.get("ParsedDate") or row.get("Date")

    out: list[AwardQuote] = []
    for cabin in wanted:
        if cabin not in CABINS:
            continue
        if row.get(f"{cabin}Available") is False:
            continue
        miles = _num(row.get(f"{cabin}MileageCost"))
        if miles is None:
            continue
        taxes_raw = _num(row.get(f"{cabin}TotalTaxes")) or 0.0
        out.append(AwardQuote(
            source=source,
            program=program,
            cabin=cabin,
            cabin_label=CABINS[cabin],
            miles=miles,
            # Taxes come back in the smallest currency unit (cents).
            taxes=round(taxes_raw / 100.0, 2),
            taxes_currency=row.get("TaxesCurrency") or "USD",
            date=when,
            origin=origin,
            destination=destination,
            direct=bool(row.get(f"{cabin}Direct")),
            seats=row.get(f"{cabin}RemainingSeats"),
            airlines=row.get(f"{cabin}Airlines"),
        ))
    return out


def get_connector() -> Optional[SeatsAeroConnector]:
    """A configured connector, or None when no key is set."""
    from app.config import settings
    if not settings.seats_aero_api_key:
        return None
    return SeatsAeroConnector(
        api_key=settings.seats_aero_api_key,
        base_url=settings.seats_aero_base_url,
    )
