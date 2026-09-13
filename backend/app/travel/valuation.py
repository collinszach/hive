"""Is this a good use of points?

The comparison board's whole job. Cents-per-point is the common unit: what one point
actually bought, after backing out the cash still paid on an award.
"""
from dataclasses import dataclass
from typing import Optional

from app.points.tracker import POINT_VALUES_CPP

# How far above or below your own baseline counts as a real difference rather than
# noise. Award pricing isn't precise enough for 0.05¢ to mean anything.
GOOD_MARGIN = 0.15
POOR_MARGIN = 0.15


@dataclass(frozen=True)
class Verdict:
    cpp: Optional[float]
    baseline: Optional[float]
    rating: str        # "great" | "good" | "fair" | "poor" | "cash" | "unknown"
    summary: str


def cents_per_point(
    cash_price: Optional[float],
    points_price: Optional[float],
    fees: float = 0.0,
) -> Optional[float]:
    """Value extracted per point: (cash avoided − cash still paid) / points, in cents.

    None when either side is unknown, rather than 0 — an unpriced award is not a
    worthless one, and averaging a zero in would quietly drag every summary down.
    """
    if cash_price is None or not points_price or points_price <= 0:
        return None
    net = cash_price - (fees or 0.0)
    return round(net / points_price * 100, 3)


def judge(
    cash_price: Optional[float],
    points_price: Optional[float],
    program: Optional[str],
    fees: float = 0.0,
) -> Verdict:
    """Rate a redemption against *your* valuation of that currency, not a published one.

    ``POINT_VALUES_CPP`` is the baseline: what you reckon a point is worth when spent
    well. Beating it means this booking is a better-than-usual use of the currency;
    falling short means the points would do more elsewhere, even if the trip is still
    worth taking.
    """
    cpp = cents_per_point(cash_price, points_price, fees)
    baseline = POINT_VALUES_CPP.get(program) if program else None

    # A cash quote isn't an unrated redemption — it spends no points at all, so
    # asking for a cash price it already has would be nonsense.
    if not points_price:
        return Verdict(None, baseline, "cash", "Cash booking — spends no points.")

    if cpp is None:
        return Verdict(None, baseline, "unknown",
                       "Add the cash price to see what these points are really buying.")
    if baseline is None:
        return Verdict(cpp, None, "unknown", f"{cpp:.2f}¢ per point.")

    if cpp >= baseline + GOOD_MARGIN * 2:
        rating, summary = "great", f"{cpp:.2f}¢ — well above your {baseline:.2f}¢ baseline."
    elif cpp >= baseline + GOOD_MARGIN:
        rating, summary = "good", f"{cpp:.2f}¢ — above your {baseline:.2f}¢ baseline."
    elif cpp >= baseline - POOR_MARGIN:
        rating, summary = "fair", f"{cpp:.2f}¢ — about your {baseline:.2f}¢ baseline."
    else:
        rating, summary = "poor", (
            f"{cpp:.2f}¢ — below your {baseline:.2f}¢ baseline; "
            f"these points would go further elsewhere."
        )
    return Verdict(cpp, baseline, rating, summary)


def cash_equivalent(points_price: float, program: Optional[str]) -> Optional[float]:
    """What the points in an award are 'worth' at baseline — the opportunity cost.

    Used to rank an award against a cash quote on one axis: the award's true cost is
    the cash you pay *plus* the value of the points you burn.
    """
    baseline = POINT_VALUES_CPP.get(program) if program else None
    if baseline is None or not points_price:
        return None
    return round(points_price * baseline / 100, 2)


def true_cost(
    cash_price: Optional[float],
    points_price: Optional[float],
    program: Optional[str],
    fees: float = 0.0,
) -> Optional[float]:
    """One comparable number per option: cash out plus the baseline value of points burnt.

    This is what lets a $1,402 Costco quote sit in the same ranking as 60,000 Amex MR
    plus $89 — the points aren't free, they're worth what you'd otherwise get for them.
    """
    if points_price:
        pts_value = cash_equivalent(float(points_price), program)
        if pts_value is None:
            return None
        return round(pts_value + (fees or 0.0), 2)
    if cash_price is not None:
        return round(float(cash_price), 2)
    return None
