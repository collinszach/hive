"""Where each points currency can be transferred, and at what ratio.

Curated data, not an API — no issuer publishes this in machine-readable form. Kept as
Python constants for the same reason ``points/tracker.py`` keeps the earn rules that
way: it's versioned in git, reviewable in a diff, and needs no migration to correct.

⚠️  **This data goes stale.** Airlines join and leave these programmes several times a
year, and ratios change. Every row carries ``verified_on``; the API surfaces it and the
UI must show it, so a stale ratio is never presented as current fact. Re-verify against
each issuer's own transfer page before relying on a number here.

The important asymmetry: **Southwest Rapid Rewards has no outbound transfer partners.**
SW RR can only be spent on Southwest, which is exactly why it's valued lower than the
transferable currencies in ``POINT_VALUES_CPP``. A planner that doesn't encode this
will suggest moving points that cannot move.
"""
from dataclasses import dataclass
from datetime import date
from typing import Optional

# When this table was last checked against issuer sources. Bump when re-verifying.
VERIFIED_ON = date(2026, 5, 1)


@dataclass(frozen=True)
class TransferPartner:
    from_program: str
    to_partner: str
    kind: str                  # "airline" | "hotel"
    # Points out : points in. 1.0 means 1:1; 0.5 means 2 of yours buy 1 of theirs.
    ratio: float
    # Smallest transfer the issuer allows, in source points.
    minimum: int = 1000
    # Typical settlement. Instant for many airline partners, days for some.
    typical_days: int = 0
    verified_on: date = VERIFIED_ON
    note: Optional[str] = None


# Representative rather than exhaustive — the partners most likely to matter for the
# programmes actually held. Add rows as needed; re-verify before trusting a ratio.
TRANSFER_PARTNERS: list[TransferPartner] = [
    # ── Amex Membership Rewards ────────────────────────────────────────────────
    TransferPartner("Amex MR", "Delta SkyMiles", "airline", 1.0),
    TransferPartner("Amex MR", "Air Canada Aeroplan", "airline", 1.0),
    TransferPartner("Amex MR", "ANA Mileage Club", "airline", 1.0, typical_days=2),
    TransferPartner("Amex MR", "British Airways Avios", "airline", 1.0),
    TransferPartner("Amex MR", "Virgin Atlantic Flying Club", "airline", 1.0),
    TransferPartner("Amex MR", "Air France/KLM Flying Blue", "airline", 1.0),
    TransferPartner("Amex MR", "Emirates Skywards", "airline", 1.0),
    TransferPartner("Amex MR", "Etihad Guest", "airline", 1.0),
    TransferPartner("Amex MR", "Qantas Frequent Flyer", "airline", 1.0),
    TransferPartner("Amex MR", "Singapore KrisFlyer", "airline", 1.0),
    TransferPartner("Amex MR", "Cathay", "airline", 1.0),
    TransferPartner("Amex MR", "Hilton Honors", "hotel", 2.0,
                    note="1:2, but Hilton points are worth far less each"),
    TransferPartner("Amex MR", "Marriott Bonvoy", "hotel", 1.0),

    # ── Chase Ultimate Rewards ─────────────────────────────────────────────────
    TransferPartner("Chase UR", "World of Hyatt", "hotel", 1.0,
                    note="usually the strongest UR redemption"),
    TransferPartner("Chase UR", "United MileagePlus", "airline", 1.0),
    TransferPartner("Chase UR", "Southwest Rapid Rewards", "airline", 1.0),
    TransferPartner("Chase UR", "British Airways Avios", "airline", 1.0),
    TransferPartner("Chase UR", "Air Canada Aeroplan", "airline", 1.0),
    TransferPartner("Chase UR", "Virgin Atlantic Flying Club", "airline", 1.0),
    TransferPartner("Chase UR", "Air France/KLM Flying Blue", "airline", 1.0),
    TransferPartner("Chase UR", "Singapore KrisFlyer", "airline", 1.0),
    TransferPartner("Chase UR", "Emirates Skywards", "airline", 1.0),
    TransferPartner("Chase UR", "IHG One Rewards", "hotel", 1.0),
    TransferPartner("Chase UR", "Marriott Bonvoy", "hotel", 1.0),

    # ── Capital One Miles ──────────────────────────────────────────────────────
    TransferPartner("Capital One Miles", "Air Canada Aeroplan", "airline", 1.0),
    TransferPartner("Capital One Miles", "Avianca LifeMiles", "airline", 1.0),
    TransferPartner("Capital One Miles", "British Airways Avios", "airline", 1.0),
    TransferPartner("Capital One Miles", "Air France/KLM Flying Blue", "airline", 1.0),
    TransferPartner("Capital One Miles", "Turkish Miles&Smiles", "airline", 1.0),
    TransferPartner("Capital One Miles", "Emirates Skywards", "airline", 1.0),
    TransferPartner("Capital One Miles", "Etihad Guest", "airline", 1.0),
    TransferPartner("Capital One Miles", "Singapore KrisFlyer", "airline", 1.0),
    TransferPartner("Capital One Miles", "Qantas Frequent Flyer", "airline", 1.0),
    TransferPartner("Capital One Miles", "Cathay", "airline", 1.0),
    TransferPartner("Capital One Miles", "Choice Privileges", "hotel", 1.0),
    TransferPartner("Capital One Miles", "Wyndham Rewards", "hotel", 1.0),

    # ── Bilt ───────────────────────────────────────────────────────────────────
    TransferPartner("Bilt Points", "World of Hyatt", "hotel", 1.0),
    TransferPartner("Bilt Points", "American AAdvantage", "airline", 1.0),
    TransferPartner("Bilt Points", "Alaska Mileage Plan", "airline", 1.0),
    TransferPartner("Bilt Points", "United MileagePlus", "airline", 1.0),
    TransferPartner("Bilt Points", "Air Canada Aeroplan", "airline", 1.0),
    TransferPartner("Bilt Points", "Air France/KLM Flying Blue", "airline", 1.0),
    TransferPartner("Bilt Points", "Virgin Atlantic Flying Club", "airline", 1.0),
    TransferPartner("Bilt Points", "Turkish Miles&Smiles", "airline", 1.0),
    TransferPartner("Bilt Points", "British Airways Avios", "airline", 1.0),
    TransferPartner("Bilt Points", "IHG One Rewards", "hotel", 1.0),
    TransferPartner("Bilt Points", "Marriott Bonvoy", "hotel", 1.0),

    # ── Southwest Rapid Rewards ────────────────────────────────────────────────
    # Intentionally empty. SW RR has no outbound transfer partners; it can only be
    # spent on Southwest. See NON_TRANSFERABLE below.
]

# Programmes that cannot be moved anywhere. Spending them is the only way to realise
# their value, and they don't appreciate while they sit.
NON_TRANSFERABLE: set[str] = {"SW RR", "WF Rewards"}


def partners_for(program: str) -> list[TransferPartner]:
    """Everywhere `program` can transfer to. Empty for a non-transferable currency."""
    return [p for p in TRANSFER_PARTNERS if p.from_program == program]


def programs_reaching(partner: str) -> list[TransferPartner]:
    """Every currency that can reach `partner` — the question a booking actually asks."""
    needle = partner.strip().lower()
    return [p for p in TRANSFER_PARTNERS if needle in p.to_partner.lower()]


def is_transferable(program: str) -> bool:
    return program not in NON_TRANSFERABLE and bool(partners_for(program))


def has_transfer_data(partner: str) -> bool:
    """Whether this table says anything at all about reaching `partner`.

    The distinction matters more than it looks. "No balance reaches Iberia" and "this
    table has never heard of Iberia" look identical to a coverage check, but only the
    first is a fact — the second is a gap in curated data. Asserting the first when
    the truth is the second tells the user their points are useless on a route where
    they may well work.
    """
    needle = partner.strip().lower()
    return any(needle in p.to_partner.lower() for p in TRANSFER_PARTNERS)


def points_needed(target_points: float, ratio: float) -> float:
    """Source points required to end up with `target_points` at `ratio`.

    A 1:2 hotel ratio means *fewer* source points are needed, not more — dividing by
    the ratio is what makes both directions come out right.
    """
    if ratio <= 0:
        raise ValueError("ratio must be positive")
    return target_points / ratio
