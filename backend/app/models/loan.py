import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Loan(Base):
    """A manually-tracked loan (e.g. a federal/private student loan for the MBA).

    No data provider exposes real-time balances for private student loans, so this
    mirrors the RothContribution pattern: the user logs entries (disbursements,
    payments, interest accrual) and the running balance is derived from them.
    """

    __tablename__ = "loans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    interest_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4), nullable=True)  # APR, e.g. 0.0550
    origination_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
