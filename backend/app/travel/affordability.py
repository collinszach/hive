"""Can this actually be paid for — in points, or in cash?

Two different questions with two different failure modes. Points you either have or
can transfer in; cash competes with everything else the month is already committed to.
"""
from dataclasses import dataclass
from typing import Optional

from app.travel.transfer_partners import (
    NON_TRANSFERABLE,
    TransferPartner,
    is_transferable,
    partners_for,
    points_needed,
)


@dataclass(frozen=True)
class PointsRoute:
    """One way to cover an award from a balance you hold."""
    program: str
    available: float
    needed: float
    direct: bool                    # already the right currency, no transfer
    partner: Optional[str] = None
    ratio: float = 1.0
    shortfall: float = 0.0
    typical_days: int = 0
    warning: Optional[str] = None

    @property
    def covered(self) -> bool:
        return self.shortfall <= 0


def routes_for_award(
    *,
    target_program: Optional[str],
    points_price: float,
    balances: dict[str, float],
) -> list[PointsRoute]:
    """How the award could be paid for, best first.

    ``target_program`` is the currency the award is priced in — often a partner
    programme (Aeroplan, Hyatt) rather than a card currency. Direct balances rank
    above transfers because a transfer is irreversible and takes time.
    """
    if not target_program or points_price <= 0:
        return []

    routes: list[PointsRoute] = []

    # Already holding the right currency.
    direct_balance = balances.get(target_program)
    if direct_balance is not None:
        routes.append(PointsRoute(
            program=target_program,
            available=direct_balance,
            needed=points_price,
            direct=True,
            shortfall=max(0.0, points_price - direct_balance),
        ))

    # Transferable currencies that reach it.
    for program, available in balances.items():
        if program == target_program:
            continue
        for partner in partners_for(program):
            if target_program.lower() not in partner.to_partner.lower():
                continue
            needed = points_needed(points_price, partner.ratio)
            routes.append(PointsRoute(
                program=program,
                available=available,
                needed=round(needed, 2),
                direct=False,
                partner=partner.to_partner,
                ratio=partner.ratio,
                shortfall=round(max(0.0, needed - available), 2),
                typical_days=partner.typical_days,
                warning=(
                    "Transfers are one-way and can't be reversed — confirm the award "
                    "seat before moving points."
                ),
            ))

    # Covered routes first, then the smallest shortfall; direct beats a transfer.
    routes.sort(key=lambda r: (not r.covered, r.shortfall, not r.direct))
    return routes


@dataclass(frozen=True)
class CashVerdict:
    cost: float
    available: float
    affordable: bool
    summary: str


def judge_cash(cost: float, cash_available: float) -> CashVerdict:
    """Whether a cash booking fits what's actually free to spend.

    ``cash_available`` is the caller's business — safe-to-spend, runway, whatever the
    position endpoint says. This only states the consequence plainly.
    """
    affordable = cost <= cash_available
    if affordable:
        left = cash_available - cost
        summary = f"Leaves ${left:,.0f} of the cash you have free."
    else:
        short = cost - cash_available
        summary = f"${short:,.0f} more than you have free right now."
    return CashVerdict(round(cost, 2), round(cash_available, 2), affordable, summary)


def spend_it_advice(program: str, balance: float) -> Optional[str]:
    """A currency-specific nudge, where the currency's nature demands one.

    Southwest Rapid Rewards can't be transferred anywhere and its value is pinned to
    Southwest's cash fares, so a large balance is idle money rather than optionality —
    the opposite of the advice that suits a transferable currency.
    """
    if program in NON_TRANSFERABLE and balance > 0:
        return (
            f"{program} can't be transferred anywhere — it's only good on its own "
            f"airline, and it doesn't grow while it sits. Spend it on a trip you're "
            f"taking anyway."
        )
    if is_transferable(program):
        return (
            "Transferable — but transfers are one-way. Don't move points until an "
            "award seat is confirmed."
        )
    return None
