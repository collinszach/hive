import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text,
                        UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Trip(Base):
    """A trip being considered, planned, or taken.

    Deliberately loose: a trip starts as an idea with no dates, and hardens as it gets
    real. Requiring a full itinerary up front would make the dreaming stage — where
    the points decision actually gets made — impossible to record.
    """

    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    destination: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    travelers: Mapped[int] = mapped_column(Integer, server_default="1")

    # dreaming → planning → booked → taken. Only `booked` and `taken` should count
    # against cash runway; a dream shouldn't move the forecast.
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="dreaming")

    cash_budget: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TripLeg(Base):
    """One bookable piece of a trip — a flight, a hotel stay, a car."""

    __tablename__ = "trip_legs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)  # flight | hotel | car | activity
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origin: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    destination: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    leg_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TravelOption(Base):
    """One way to book a leg — cash or points, from a portal or an award chart.

    Both prices are nullable and independent: a cash quote has no points price, an
    award has both a points price and (nearly always) a small cash fee. Cents-per-point
    is derived rather than stored so a change to how it's computed can't leave stale
    numbers sitting in the database.
    """

    __tablename__ = "travel_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    leg_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip_legs.id", ondelete="CASCADE"), nullable=False
    )
    # Where the quote came from. Manual sources exist because Costco Travel and the
    # issuer portals have no public API — see docs/TRAVEL-SPEC.md.
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="manual_cash")
    label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cash_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    points_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    program: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Cash still due on an award booking (taxes, carrier surcharges).
    fees: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")

    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Quotes go stale. Recording when it was taken is the difference between a
    # comparison and a guess.
    quoted_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_selected: Mapped[bool] = mapped_column(Boolean, server_default="false")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TripTransaction(Base):
    """Links a real transaction to a trip, so planned can be checked against actual.

    An explicit link rather than a date-window query: travel charges post weeks before
    and after a trip, and a window would quietly claim a neighbouring holiday's flights.
    The API suggests candidates; the user decides which are really this trip's.
    """

    __tablename__ = "trip_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # A transaction belongs to at most one trip — splitting one charge across two trips
    # would double-count it in every actual-spend total.
    __table_args__ = (
        UniqueConstraint("transaction_id", name="uq_trip_transaction_transaction"),
    )
