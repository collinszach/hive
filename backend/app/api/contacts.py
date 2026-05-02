"""Contacts API — people you split expenses with."""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.contact import Contact
from app.models.expense_share import ExpenseShare

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/contacts", tags=["contacts"])


class ContactOut(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class ContactCreate(BaseModel):
    name: str


@router.get("", response_model=list[ContactOut])
async def list_contacts(db: AsyncSession = Depends(get_db)) -> list[ContactOut]:
    result = await db.execute(select(Contact).order_by(Contact.name))
    return [ContactOut.model_validate(c) for c in result.scalars().all()]


@router.post("", response_model=ContactOut, status_code=201)
async def create_contact(body: ContactCreate, db: AsyncSession = Depends(get_db)) -> ContactOut:
    contact = Contact(name=body.name.strip())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ContactOut.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactOut)
async def rename_contact(
    contact_id: uuid.UUID,
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
) -> ContactOut:
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.name = body.name.strip()
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ContactOut.model_validate(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(contact_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    pending_count_q = await db.execute(
        select(func.count()).select_from(ExpenseShare).where(
            ExpenseShare.contact_id == contact_id,
            ExpenseShare.status == "pending",
        )
    )
    if (pending_count_q.scalar_one() or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Contact has pending expense shares — settle them before deleting.",
        )
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
