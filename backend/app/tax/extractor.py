"""
Claude Vision document extraction for tax forms.
Reads uploaded image/PDF and returns structured JSON for each form type.
"""
from __future__ import annotations
import base64
import json
import logging
from pathlib import Path

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

# Document-type extraction schemas
DOC_PROMPTS = {
    "W2": """Extract these fields from the W-2 form. Return ONLY valid JSON, no markdown:
{
  "employer_name": "string",
  "box1_wages": number,
  "box2_federal_withheld": number,
  "box3_ss_wages": number,
  "box4_ss_withheld": number,
  "box5_medicare_wages": number,
  "box6_medicare_withheld": number,
  "box12_codes": [{"code": "string", "amount": number}],
  "box16_state_wages": number,
  "box17_state_withheld": number,
  "state": "string"
}
If a field is not present or illegible, use 0 for numbers and "" for strings.""",

    "1099NEC": """Extract these fields from the 1099-NEC form. Return ONLY valid JSON, no markdown:
{
  "payer_name": "string",
  "box1_nonemployee_comp": number,
  "box4_federal_withheld": number
}
If a field is not present or illegible, use 0 for numbers and "" for strings.""",

    "1099DIV": """Extract these fields from the 1099-DIV form. Return ONLY valid JSON, no markdown:
{
  "payer_name": "string",
  "box1a_ordinary_dividends": number,
  "box1b_qualified_dividends": number,
  "box2a_total_capital_gain": number,
  "box4_federal_withheld": number
}
If a field is not present or illegible, use 0 for numbers.""",

    "1099INT": """Extract these fields from the 1099-INT form. Return ONLY valid JSON, no markdown:
{
  "payer_name": "string",
  "box1_interest_income": number,
  "box4_federal_withheld": number,
  "box8_tax_exempt_interest": number
}
If a field is not present or illegible, use 0 for numbers.""",

    "1099B": """Extract the transactions from this 1099-B form. Return ONLY valid JSON, no markdown:
{
  "entries": [
    {
      "description": "string",
      "proceeds": number,
      "cost_basis": number,
      "holding_period": "short" or "long",
      "wash_sale_adj": number,
      "federal_withheld": number
    }
  ]
}
holding_period: "short" if box held <= 1 year, "long" if > 1 year.
If a field is not present, use 0 for numbers.""",

    "1099G": """Extract these fields from the 1099-G form. Return ONLY valid JSON, no markdown:
{
  "payer_name": "string",
  "box1_unemployment_comp": number,
  "box4_federal_withheld": number,
  "box11_state_local_refunds": number
}
If a field is not present or illegible, use 0 for numbers.""",
}


def extract_tax_document(file_path: str, doc_type: str) -> dict:
    """
    Use Claude Vision to extract structured data from a tax document image/PDF.

    Returns the extracted dict, or raises ValueError on failure.
    """
    path = Path(file_path)
    if not path.exists():
        raise ValueError(f"File not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        media_type = "image/jpeg"
    elif suffix == ".png":
        media_type = "image/png"
    elif suffix == ".pdf":
        media_type = "application/pdf"
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    with open(path, "rb") as f:
        file_data = base64.standard_b64encode(f.read()).decode("utf-8")

    prompt = DOC_PROMPTS.get(doc_type)
    if not prompt:
        raise ValueError(f"Unknown doc_type: {doc_type}")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    if suffix == ".pdf":
        # Use document block for PDFs
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": file_data,
                },
            },
            {"type": "text", "text": prompt},
        ]
    else:
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": file_data,
                },
            },
            {"type": "text", "text": prompt},
        ]

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": content}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if Claude added them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("extractor: JSON parse failed for %s: %s | raw: %s", doc_type, e, raw[:200])
        raise ValueError(f"Claude returned unparseable JSON for {doc_type}") from e
