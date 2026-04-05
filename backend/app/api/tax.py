"""Tax calculator API — document upload, extraction, and calculation."""
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tax_document import TaxDocument
from app.models.tax_calculation import TaxCalculation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tax", tags=["tax"])

TAX_DOCS_DIR = Path("/data/tax-docs")
TAX_DOCS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_DOC_TYPES = {"W2", "1099NEC", "1099DIV", "1099INT", "1099B", "1099G"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


# ── Document Upload ────────────────────────────────────────────────────────────

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    tax_year: int = Form(2024),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(400, f"doc_type must be one of {sorted(ALLOWED_DOC_TYPES)}")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File must be PDF, JPG, or PNG")

    # Save file
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{suffix}"
    file_path = TAX_DOCS_DIR / filename
    contents = await file.read()
    file_path.write_bytes(contents)

    doc = TaxDocument(
        tax_year=tax_year,
        doc_type=doc_type,
        filename=file.filename or filename,
        file_path=str(file_path),
        extraction_status="pending",
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    logger.info("Uploaded tax doc id=%s type=%s year=%d", doc.id, doc_type, tax_year)
    return {
        "id": str(doc.id),
        "doc_type": doc.doc_type,
        "tax_year": doc.tax_year,
        "filename": doc.filename,
        "extraction_status": doc.extraction_status,
    }


@router.get("/documents")
async def list_documents(
    tax_year: int = 2024,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await session.execute(
        select(TaxDocument)
        .where(TaxDocument.tax_year == tax_year)
        .order_by(TaxDocument.created_at)
    )
    return [
        {
            "id": str(d.id),
            "doc_type": d.doc_type,
            "tax_year": d.tax_year,
            "filename": d.filename,
            "extraction_status": d.extraction_status,
            "extracted_json": d.extracted_json,
        }
        for d in result.scalars().all()
    ]


@router.post("/documents/{doc_id}/extract")
async def extract_document(
    doc_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Trigger Claude Vision extraction for a document."""
    result = await session.execute(
        select(TaxDocument).where(TaxDocument.id == uuid.UUID(doc_id))
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(404, "Document not found")

    from app.tax.extractor import extract_tax_document
    try:
        doc.extraction_status = "processing"
        await session.commit()

        extracted = extract_tax_document(doc.file_path, doc.doc_type)
        doc.extracted_json = extracted
        doc.extraction_status = "done"
        await session.commit()
        logger.info("Extracted doc id=%s type=%s", doc.id, doc.doc_type)
        return {"id": str(doc.id), "extraction_status": "done", "extracted_json": extracted}

    except Exception as exc:
        doc.extraction_status = "failed"
        await session.commit()
        logger.error("Extraction failed doc=%s: %s", doc.id, exc)
        raise HTTPException(500, f"Extraction failed: {exc}")


@router.put("/documents/{doc_id}")
async def update_document(
    doc_id: str,
    body: dict,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Update extracted_json (user corrections)."""
    result = await session.execute(
        select(TaxDocument).where(TaxDocument.id == uuid.UUID(doc_id))
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(404, "Document not found")
    if "extracted_json" in body:
        doc.extracted_json = body["extracted_json"]
        await session.commit()
    return {"id": str(doc.id), "extracted_json": doc.extracted_json}


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(TaxDocument).where(TaxDocument.id == uuid.UUID(doc_id))
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(404, "Document not found")
    # Remove file from disk
    p = Path(doc.file_path)
    if p.exists():
        p.unlink()
    await session.delete(doc)
    await session.commit()


# ── Calculate ──────────────────────────────────────────────────────────────────

class TaxCalculateRequest(BaseModel):
    tax_year: int = 2024
    filing_status: str = "single"   # single | mfj | mfs | hoh
    dependents: int = 0
    state: str = "TX"
    pull_transactions: bool = False
    # Manual overrides / additional inputs
    mortgage_interest: float = 0.0
    state_local_taxes_paid: float = 0.0
    se_health_insurance: float = 0.0
    student_loan_interest: float = 0.0
    child_dependent_care_credit: float = 0.0
    education_credits: float = 0.0


@router.post("/calculate")
async def calculate_taxes(
    body: TaxCalculateRequest,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Aggregate all extracted documents for the given year, then run
    the federal + state tax engine.
    """
    from app.tax.engine import calculate_federal_tax
    from app.tax.state_brackets import compute_state_tax

    # 1. Load all extracted documents for this year
    docs_result = await session.execute(
        select(TaxDocument).where(
            TaxDocument.tax_year == body.tax_year,
            TaxDocument.extraction_status == "done",
        )
    )
    docs = docs_result.scalars().all()

    # 2. Aggregate income figures from documents
    w2_wages = 0.0
    federal_withheld = 0.0
    state_withheld = 0.0
    se_income = 0.0
    ordinary_dividends = 0.0
    qualified_dividends = 0.0
    taxable_interest = 0.0
    st_capital_gains = 0.0
    lt_capital_gains = 0.0
    unemployment_comp = 0.0

    for doc in docs:
        d = doc.extracted_json or {}
        if doc.doc_type == "W2":
            w2_wages += float(d.get("box1_wages", 0))
            federal_withheld += float(d.get("box2_federal_withheld", 0))
            state_withheld += float(d.get("box17_state_withheld", 0))
        elif doc.doc_type == "1099NEC":
            se_income += float(d.get("box1_nonemployee_comp", 0))
            federal_withheld += float(d.get("box4_federal_withheld", 0))
        elif doc.doc_type == "1099DIV":
            ordinary_dividends += float(d.get("box1a_ordinary_dividends", 0))
            qualified_dividends += float(d.get("box1b_qualified_dividends", 0))
            lt_capital_gains += float(d.get("box2a_total_capital_gain", 0))
            federal_withheld += float(d.get("box4_federal_withheld", 0))
        elif doc.doc_type == "1099INT":
            taxable_interest += float(d.get("box1_interest_income", 0))
            federal_withheld += float(d.get("box4_federal_withheld", 0))
        elif doc.doc_type == "1099B":
            for entry in d.get("entries", []):
                net = float(entry.get("proceeds", 0)) - float(entry.get("cost_basis", 0)) - float(entry.get("wash_sale_adj", 0))
                if entry.get("holding_period") == "long":
                    lt_capital_gains += net
                else:
                    st_capital_gains += net
                federal_withheld += float(entry.get("federal_withheld", 0))
        elif doc.doc_type == "1099G":
            unemployment_comp += float(d.get("box1_unemployment_comp", 0))
            federal_withheld += float(d.get("box4_federal_withheld", 0))

    # 3. Pull deductible transactions (business expenses) if requested
    charitable_from_txns = 0.0
    if body.pull_transactions:
        from sqlalchemy import text
        char_result = await session.execute(
            text("""
                SELECT SUM(amount) AS total
                FROM transactions
                WHERE subcategory = 'Charitable'
                  AND NOT is_excluded AND NOT pending AND amount > 0
                  AND EXTRACT(YEAR FROM date) = :year
            """),
            {"year": body.tax_year},
        )
        cr = char_result.fetchone()
        charitable_from_txns = float(cr.total or 0)

    # 4. Federal calculation
    federal_result = calculate_federal_tax(
        w2_wages=w2_wages,
        se_income=se_income,
        ordinary_dividends=ordinary_dividends,
        qualified_dividends=qualified_dividends,
        taxable_interest=taxable_interest,
        st_capital_gains=st_capital_gains,
        lt_capital_gains=lt_capital_gains,
        unemployment_comp=unemployment_comp,
        filing_status=body.filing_status,
        dependents=body.dependents,
        tax_year=body.tax_year,
        mortgage_interest=body.mortgage_interest,
        state_local_taxes_paid=body.state_local_taxes_paid,
        charitable_contributions=charitable_from_txns,
        se_health_insurance=body.se_health_insurance,
        student_loan_interest=body.student_loan_interest,
        child_dependent_care_credit=body.child_dependent_care_credit,
        education_credits=body.education_credits,
        federal_withheld=federal_withheld,
    )

    # 5. State calculation
    state_taxable = federal_result["agi"] - federal_result["deduction_used"]
    state_tax = compute_state_tax(
        taxable_income=max(0, state_taxable),
        state=body.state,
        filing_status=body.filing_status,
        year=body.tax_year,
    )
    state_owed = round(state_tax - state_withheld, 2)

    # 6. Claude key insights
    insights = await _generate_insights(federal_result, state_owed, body.state, session)

    # 7. Build and save result
    results = {
        "federal": federal_result,
        "state": {
            "state": body.state,
            "state_tax": state_tax,
            "state_withheld": round(state_withheld, 2),
            "state_owed": state_owed,
            "state_refund": max(0, -state_owed),
        },
        "combined_owed": round(federal_result["federal_owed"] + state_owed, 2),
        "insights": insights,
    }

    calc = TaxCalculation(
        tax_year=body.tax_year,
        filing_status=body.filing_status,
        state=body.state,
        inputs_json=body.model_dump(),
        results_json=results,
    )
    session.add(calc)
    await session.commit()
    await session.refresh(calc)
    results["calculation_id"] = str(calc.id)
    return results


async def _generate_insights(federal: dict, state_owed: float, state: str, session) -> list[str]:
    """Ask Claude for 3-5 plain-English insights about the tax result."""
    import json
    import anthropic
    from app.config import settings

    prompt = f"""Given this tax calculation summary, provide 3-5 concise, actionable insights.
Focus on: what's driving the bill, what the person can do differently, and any notable optimizations.
Be specific with dollar amounts. Each insight is one sentence.

Federal tax owed/refund: ${federal['federal_owed']:,.0f}
Effective federal rate: {federal['effective_rate_pct']}%
Marginal rate: {federal['marginal_rate_pct']}%
SE income: ${federal['se_income']:,.0f}
SE tax: ${federal['se_tax']:,.0f}
Used standard deduction: {federal['used_standard_deduction']} (${federal['deduction_used']:,.0f})
LTCG: ${federal['lt_capital_gains']:,.0f} taxed at {0 if federal['ltcg_tax'] == 0 else round(federal['ltcg_tax'] / max(federal['lt_capital_gains'], 0.01) * 100, 1)}%
State: {state}, state owed: ${state_owed:,.0f}
Quarterly estimated payment: ${federal['quarterly_estimated_payment']:,.0f}

Return a JSON array of strings (insight sentences only), no markdown:
["insight 1", "insight 2", ...]"""

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        logger.warning("_generate_insights failed: %s", e)
        return []


@router.get("/calculations")
async def list_calculations(session: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await session.execute(
        select(TaxCalculation).order_by(TaxCalculation.created_at.desc()).limit(20)
    )
    return [
        {"id": str(c.id), "tax_year": c.tax_year, "filing_status": c.filing_status,
         "state": c.state, "created_at": c.created_at.isoformat()}
        for c in result.scalars().all()
    ]


@router.get("/calculations/{calc_id}")
async def get_calculation(calc_id: str, session: AsyncSession = Depends(get_db)) -> dict:
    result = await session.execute(
        select(TaxCalculation).where(TaxCalculation.id == uuid.UUID(calc_id))
    )
    c = result.scalar_one_or_none()
    if c is None:
        raise HTTPException(404, "Calculation not found")
    return {"id": str(c.id), "tax_year": c.tax_year, "filing_status": c.filing_status,
            "state": c.state, **c.results_json}
