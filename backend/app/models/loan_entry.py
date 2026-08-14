import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LoanEntry(Base):
    """One entry in a loan's ledger. `amount` is signed relative to the loan
    balance: disbursements and capitalized interest are positive (increase what's
    owed), payments are negative (decrease what's owed). Balance = running sum."""

    __tablename__ = "loan_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    entry_type: Mapped[str] = mapped_column(Text, nullable=False)  # disbursement | payment | interest
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "entry_type IN ('disbursement', 'payment', 'interest')",
            name="ck_loan_entries_entry_type",
        ),
    )
