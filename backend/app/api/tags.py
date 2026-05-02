"""Tags API — create/list tags and apply them to transactions."""
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tag import Tag, TransactionTag
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagOut(BaseModel):
    id: uuid.UUID
    name: str
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class TagCreateRequest(BaseModel):
    name: str
    color: Optional[str] = None


class TagTransactionRequest(BaseModel):
    transaction_id: uuid.UUID


@router.get("", response_model=list[TagOut])
async def list_tags(db: AsyncSession = Depends(get_db)) -> list[TagOut]:
    """List all available tags."""
    result = await db.execute(select(Tag).order_by(Tag.name))
    return list(result.scalars().all())


@router.post("", response_model=TagOut)
async def create_tag(body: TagCreateRequest, db: AsyncSession = Depends(get_db)) -> TagOut:
    """Create a new tag. Returns existing tag if name already exists."""
    name = body.name.strip().lower()
    if not name:
        raise HTTPException(status_code=422, detail="Tag name cannot be empty")

    stmt = pg_insert(Tag).values(name=name, color=body.color)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_tags_name",
        set_={"color": stmt.excluded.color},
    ).returning(Tag)
    result = await db.execute(stmt)
    await db.commit()
    tag = result.scalar_one()
    return TagOut.model_validate(tag)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a tag and remove it from all transactions."""
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()


@router.get("/transaction/{transaction_id}", response_model=list[TagOut])
async def get_transaction_tags(transaction_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[TagOut]:
    """Get all tags for a transaction."""
    result = await db.execute(
        select(Tag)
        .join(TransactionTag, TransactionTag.tag_id == Tag.id)
        .where(TransactionTag.transaction_id == transaction_id)
        .order_by(Tag.name)
    )
    return list(result.scalars().all())


@router.post("/transaction/{transaction_id}/{tag_id}", status_code=204)
async def add_tag_to_transaction(
    transaction_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Apply a tag to a transaction."""
    # Verify both exist
    tx = (await db.execute(select(Transaction).where(Transaction.id == transaction_id))).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tag = (await db.execute(select(Tag).where(Tag.id == tag_id))).scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    stmt = pg_insert(TransactionTag).values(
        transaction_id=transaction_id, tag_id=tag_id
    ).on_conflict_do_nothing()
    await db.execute(stmt)
    await db.commit()
    logger.info("Tagged transaction %s with %s", transaction_id, tag.name)


@router.delete("/transaction/{transaction_id}/{tag_id}", status_code=204)
async def remove_tag_from_transaction(
    transaction_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a tag from a transaction."""
    await db.execute(
        delete(TransactionTag).where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                TransactionTag.tag_id == tag_id,
            )
        )
    )
    await db.commit()
