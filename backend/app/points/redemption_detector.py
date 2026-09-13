"""Spotting award redemptions in the transaction feed.

An award booking pays the fare in points, so nothing reaches the card except taxes
and carrier fees. That small airline charge is the *only* trace a redemption leaves —
there is no issuer API that would tell us, and the points ledger records earning only.
Left undetected, a displayed balance drifts upward forever.

The live ledger shows the pattern plainly::

    2026-01-20  QANTAS MASCOT AU        $5.60
    2026-01-23  ETIHAD AIRWAYS NEW YORK $14.57
    2026-08-06  SOUTHWES 5262187727698  $11.20

``$5.60`` is exactly the US TSA September 11th Security Fee for one one-way domestic
segment, and ``$11.20`` is two of them. A $5.60 charge from *Qantas* is not a Qantas
ticket.

Nothing here writes to a balance. Detection only raises a candidate for review, since
the one thing the feed can never reveal is how many points the ticket cost.
"""
import re
from typing import Optional

# Above this, a travel charge is far more likely a real cash fare than award taxes.
# International carrier-imposed surcharges can exceed it — those are caught by the
# user recording a redemption by hand, not by widening this and drowning them in
# false positives.
AWARD_FEE_MAX = 100.00

# US September 11th Security Fee, per one-way segment. Multiples are the single
# strongest signal available: a cash fare essentially never lands on an exact multiple.
TSA_SEGMENT_FEE = 5.60
MAX_SEGMENTS = 8

_AIRLINE = re.compile(
    r"southwest|southwes|delta air|united airlines?|american airlines?|jetblue|"
    r"spirit airlines?|frontier airlines?|alaska air|hawaiian air|allegiant|"
    r"air canada|aeroplan|british airways|virgin atlantic|iberia|aer lingus|"
    r"lufthansa|swiss air|austrian|brussels airlines|air france|klm|"
    r"emirates|etihad|qatar airways|turkish airlines|singapore air|cathay|"
    r"ana |all nippon|japan airlines|korean air|qantas|avianca|copa|latam|"
    r"aeromexico|tap portugal|sas |finnair|icelandair|azul|gol ",
    re.I,
)

_HOTEL = re.compile(
    r"marriott|hilton|hyatt|ihg |intercontinental|wyndham|best western|"
    r"hampton inn|holiday inn|sheraton|westin|fairfield|courtyard|residence inn|"
    r"doubletree|embassy suites|waldorf|conrad|ritz|st regis|le meridien|"
    r"aloft|moxy|kimpton|crowne plaza|radisson|choice hotels|comfort inn",
    re.I,
)

# Small travel charges that are emphatically *not* award taxes. Without these the
# detector flags lounge memberships and trusted-traveller fees every time.
_NOT_AWARD = re.compile(
    r"priority pass|clear |clearme|tsa pre|precheck|global entry|nexus|"
    r"wifi|wi-fi|gogo|in-flight|inflight|baggage|bag fee|seat fee|upgrade fee|"
    r"parking|shuttle|lounge membership|annual fee|trip insurance|travel insurance",
    re.I,
)

# Reason codes, strongest first. Exposed so the API and UI can rank and explain.
REASON_RANK = {
    "tsa_segment_fee": 0,
    "small_airline_charge": 1,
    "small_hotel_charge": 2,
}


def _is_tsa_multiple(amount: float) -> bool:
    """True when the amount is an exact multiple of the per-segment security fee."""
    for segments in range(1, MAX_SEGMENTS + 1):
        if abs(amount - TSA_SEGMENT_FEE * segments) < 0.005:
            return True
    return False


def classify_award_fee(
    *,
    merchant: Optional[str],
    raw_description: Optional[str],
    amount: float,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
) -> Optional[str]:
    """Why this charge looks like the tax on an award booking, or None.

    Positive amounts only — a refund is not a redemption. Returns a reason code from
    ``REASON_RANK``; the caller decides what to do with it (this never writes).
    """
    if amount <= 0 or amount > AWARD_FEE_MAX:
        return None

    text = f"{merchant or ''} {raw_description or ''}".strip()
    if not text:
        return None
    if _NOT_AWARD.search(text):
        return None

    is_airline = bool(_AIRLINE.search(text))
    is_hotel = bool(_HOTEL.search(text))

    # A travel-categorised charge from an unrecognised merchant still counts — the
    # airline list can't be exhaustive, and the categoriser has already done the work.
    if not is_airline and not is_hotel:
        if subcategory in ("Flights", "SW Flights"):
            is_airline = True
        elif subcategory == "Hotel":
            is_hotel = True
        else:
            return None

    if is_airline and _is_tsa_multiple(amount):
        return "tsa_segment_fee"
    if is_airline:
        return "small_airline_charge"
    return "small_hotel_charge"


def explain(reason: Optional[str], amount: float) -> str:
    """One line a human can judge, for the review queue."""
    if reason == "tsa_segment_fee":
        segments = round(amount / TSA_SEGMENT_FEE)
        leg = "leg" if segments == 1 else "legs"
        return (
            f"${amount:.2f} is exactly {segments} × the $5.60 US security fee "
            f"({segments} {leg}) — the shape of award taxes, not a fare."
        )
    if reason == "small_airline_charge":
        return f"${amount:.2f} is too small to be a fare — likely taxes on an award booking."
    if reason == "small_hotel_charge":
        return f"${amount:.2f} is too small to be a room rate — likely fees on a points stay."
    return ""
