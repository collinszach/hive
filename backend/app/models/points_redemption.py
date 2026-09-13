import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PointsRedemption(Base):
    """Points spent — the other half of the ledger.

    ``points_ledger`` only ever records points *earned*, and its recompute task
    rewrites a row per transaction, so a negative entry there would be clobbered on
    the next run. Redemptions therefore live in their own table.

    A row usually starts as a ``candidate`` raised by the award-fee detector: an award
    booking pays the fare in points, so nothing hits the card except taxes and fees,
    and that small airline charge is the only trace in the transaction feed. The user
    confirms how many points it cost (nothing else can know), at which point it starts
    reducing the displayed balance.
    """

    __tablename__ = "points_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # The fee charge that gave the redemption away. Nullable because a redemption can
    # be recorded by hand with no out-of-pocket cost at all (some awards cost nothing).
    transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True
    )

    # Unset until confirmed — the detector can see that points were spent, never which
    # currency or how many.
    program: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    points_spent: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    # What the cash booking would have cost, if known. Drives cents-per-point; optional
    # because it's a judgement the user may not want to make.
    cash_value_avoided: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    # Out of pocket on the award (the fee charge itself).
    fees_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")

    redeemed_on: Mapped[date] = mapped_column(Date, nullable=False)
    merchant: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # candidate → confirmed | dismissed. Only `confirmed` affects balances.
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="candidate")
    # Why the detector flagged it, so a stale heuristic can be audited later.
    detection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # One candidate per fee charge, so re-running the detector is idempotent.
    __table_args__ = (
        UniqueConstraint("transaction_id", name="uq_points_redemption_transaction"),
    )

    @property
    def cents_per_point(self) -> Optional[float]:
        """Value actually extracted: (cash avoided − fees) / points, in cents.

        None unless both sides are known — an unvalued redemption shouldn't be
        averaged in as a zero.
        """
        if not self.points_spent or self.cash_value_avoided is None:
            return None
        pts = float(self.points_spent)
        if pts <= 0:
            return None
        net = float(self.cash_value_avoided) - float(self.fees_paid or 0)
        return round(net / pts * 100, 3)
