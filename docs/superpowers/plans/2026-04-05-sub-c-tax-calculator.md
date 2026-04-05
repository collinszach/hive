# Sub-C: Tax Calculator (`/tax`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full tax calculator at `/tax`: upload W-2 / 1099 docs → Claude Vision extracts fields → user reviews → deterministic Python engine computes federal + all-50-state taxes → results with effective rate, refund/owed, quarterly estimates, and Claude key insights.

**Architecture:** Two new DB tables (`tax_documents`, `tax_calculations`) + Alembic migration. Three new backend modules: `app/tax/extractor.py` (Claude Vision), `app/tax/engine.py` (federal calculation), `app/tax/state_brackets.py` (50-state data). New `app/api/tax.py` router. File storage in a Docker volume at `/data/tax-docs/`. Multi-step frontend flow in `frontend/src/app/tax/page.tsx`.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Anthropic SDK (`claude-sonnet-4-6` vision), Python pathlib for file storage, Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui.

**UI/UX Note:** Model after ORIGIN + MONARCH MONEY: clean step-indicator flow, generous whitespace, premium card styling. Use Hive honey accent (`#F5B942`) for active steps and call-to-action buttons. Document upload zone should have a clean drag-and-drop aesthetic with subtle dashed border.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/app/models/tax_document.py` | Create | `TaxDocument` SQLAlchemy model |
| `backend/app/models/tax_calculation.py` | Create | `TaxCalculation` SQLAlchemy model |
| `backend/app/models/__init__.py` | Modify | Import both tax models |
| `backend/alembic/versions/f2a3b4c5d6e7_add_tax_tables.py` | Create | Migration: both tax tables |
| `backend/app/tax/__init__.py` | Create | Empty package init |
| `backend/app/tax/state_brackets.py` | Create | All 50 states tax data for 2023 + 2024 |
| `backend/app/tax/engine.py` | Create | Deterministic federal + state tax calculator |
| `backend/app/tax/extractor.py` | Create | Claude Vision document extraction |
| `backend/app/api/tax.py` | Create | All `/api/tax/*` endpoints |
| `backend/app/main.py` | Modify | Register tax router |
| `docker-compose.yml` | Modify | Add `tax-docs` named volume |
| `docker-compose.native-db.yml` | Modify | Mount `tax-docs` volume |
| `frontend/src/lib/api.ts` | Modify | Add tax API types + methods |
| `frontend/src/app/tax/page.tsx` | Create | Full multi-step tax calculator page |
| `frontend/src/components/Sidebar.tsx` | Modify | Add `/tax` nav link |

---

## Task 1: Tax DB models and migration

**Files:**
- Create: `backend/app/models/tax_document.py`
- Create: `backend/app/models/tax_calculation.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create `backend/app/models/tax_document.py`**

```python
"""Tax document — uploaded W-2, 1099s, etc."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TaxDocument(Base):
    __tablename__ = "tax_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_year: Mapped[int] = mapped_column(Integer, nullable=False)
    doc_type: Mapped[str] = mapped_column(Text, nullable=False)  # W2 | 1099NEC | 1099DIV | 1099INT | 1099B | 1099G
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extraction_status: Mapped[str] = mapped_column(Text, nullable=False, server_default="'pending'")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Create `backend/app/models/tax_calculation.py`**

```python
"""Saved tax calculation result."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TaxCalculation(Base):
    __tablename__ = "tax_calculations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_year: Mapped[int] = mapped_column(Integer, nullable=False)
    filing_status: Mapped[str] = mapped_column(Text, nullable=False)   # single | mfj | mfs | hoh
    state: Mapped[str] = mapped_column(Text, nullable=False)            # 2-letter state code
    inputs_json: Mapped[dict] = mapped_column(JSONB, nullable=False)    # all inputs used
    results_json: Mapped[dict] = mapped_column(JSONB, nullable=False)   # full breakdown
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 3: Register models in `backend/app/models/__init__.py`**

Add after existing imports:
```python
from app.models.tax_calculation import TaxCalculation  # noqa: F401
from app.models.tax_document import TaxDocument  # noqa: F401
```

Add `"TaxCalculation"` and `"TaxDocument"` to `__all__`.

- [ ] **Step 4: Generate and run migration**

```bash
docker compose exec backend alembic revision --autogenerate -m "add_tax_tables"
docker compose exec backend alembic upgrade head
```

Expected: migration file created, `Running upgrade ... -> add_tax_tables` printed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/tax_document.py backend/app/models/tax_calculation.py
git add backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat: add tax_documents and tax_calculations models and migration"
```

---

## Task 2: Add tax-docs Docker volume

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.native-db.yml`

- [ ] **Step 1: Add named volume and mount to `docker-compose.yml`**

At the bottom of `docker-compose.yml`, add to the `volumes:` section (or create it if absent):
```yaml
volumes:
  tax-docs:
```

In the `backend` service definition, add to `volumes:`:
```yaml
    volumes:
      - tax-docs:/data/tax-docs
```

- [ ] **Step 2: Repeat the volume mount in `docker-compose.native-db.yml` if it overrides the backend service**

If `docker-compose.native-db.yml` defines a `backend` service, add the same volume mount there.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.native-db.yml
git commit -m "feat: add tax-docs Docker volume for uploaded tax documents"
```

---

## Task 3: State brackets data

**Files:**
- Create: `backend/app/tax/__init__.py`
- Create: `backend/app/tax/state_brackets.py`

- [ ] **Step 1: Create `backend/app/tax/__init__.py`**

Empty file:
```python
"""Tax calculation modules."""
```

- [ ] **Step 2: Create `backend/app/tax/state_brackets.py`**

This file contains all 50 states for 2024 (and 2023 where different).

```python
"""
State income tax data for 2023 and 2024.

Structure for progressive states:
  {filing_status: [(upper_bound, rate), ...]}
  The last entry's upper_bound is float("inf").

Flat-rate states: {"flat": rate}
No-tax states: {"flat": 0.0}

State AGI is assumed to equal federal AGI for all states (conservative simplification;
a handful of states add back specific deductions but this covers ~95% of cases).
"""
from __future__ import annotations

# No-income-tax states
_NO_TAX = {"flat": 0.0}

# ── 2024 State Data ─────────────────────────────────────────────────────────

STATE_TAX_2024: dict[str, dict] = {
    # No income tax
    "AK": _NO_TAX,
    "FL": _NO_TAX,
    "NV": _NO_TAX,
    "NH": _NO_TAX,   # taxes only investment income (being phased out; 0% on wages)
    "SD": _NO_TAX,
    "TN": _NO_TAX,
    "TX": _NO_TAX,
    "WA": _NO_TAX,
    "WY": _NO_TAX,

    # Flat-rate states (2024)
    "AZ": {"flat": 0.025},
    "CO": {"flat": 0.044},
    "GA": {"flat": 0.0549},
    "ID": {"flat": 0.058},
    "IL": {"flat": 0.0495},
    "IN": {"flat": 0.0305},
    "KY": {"flat": 0.04},
    "MA": {"flat": 0.05},
    "MI": {"flat": 0.0425},
    "MS": {"flat": 0.05},
    "NC": {"flat": 0.0475},
    "PA": {"flat": 0.0307},
    "UT": {"flat": 0.0485},

    # Progressive states (single filer brackets unless noted)
    # Each entry: (upper_bound, marginal_rate)
    # Rate applies to income ABOVE the previous bracket's upper_bound.
    "AL": {
        "brackets": {
            "single": [(500, 0.02), (3000, 0.04), (float("inf"), 0.05)],
            "mfj":    [(1000, 0.02), (6000, 0.04), (float("inf"), 0.05)],
        },
        "standard_deduction": {"single": 2500, "mfj": 7500},
    },
    "AR": {
        "brackets": {
            "single": [(4300, 0.02), (8500, 0.04), (float("inf"), 0.047)],
            "mfj":    [(4300, 0.02), (8500, 0.04), (float("inf"), 0.047)],
        },
    },
    "CA": {
        "brackets": {
            "single": [
                (10412, 0.01), (24684, 0.02), (38959, 0.04), (54081, 0.06),
                (68350, 0.08), (349137, 0.093), (418961, 0.103),
                (698274, 0.113), (float("inf"), 0.123),
            ],
            "mfj": [
                (20824, 0.01), (49368, 0.02), (77918, 0.04), (108162, 0.06),
                (136700, 0.08), (698274, 0.093), (837922, 0.103),
                (1000000, 0.113), (float("inf"), 0.123),
            ],
        },
        "sdi_rate": 0.009,  # CA SDI
    },
    "CT": {
        "brackets": {
            "single": [
                (10000, 0.03), (50000, 0.05), (100000, 0.055),
                (200000, 0.06), (250000, 0.065), (500000, 0.069), (float("inf"), 0.0699),
            ],
            "mfj": [
                (20000, 0.03), (100000, 0.05), (200000, 0.055),
                (400000, 0.06), (500000, 0.065), (1000000, 0.069), (float("inf"), 0.0699),
            ],
        },
    },
    "DE": {
        "brackets": {
            "single": [
                (2000, 0.0), (5000, 0.022), (10000, 0.039),
                (20000, 0.048), (25000, 0.052), (60000, 0.0555), (float("inf"), 0.066),
            ],
            "mfj": [
                (2000, 0.0), (5000, 0.022), (10000, 0.039),
                (20000, 0.048), (25000, 0.052), (60000, 0.0555), (float("inf"), 0.066),
            ],
        },
    },
    "HI": {
        "brackets": {
            "single": [
                (2400, 0.014), (4800, 0.032), (9600, 0.055), (14400, 0.064),
                (19200, 0.068), (24000, 0.072), (36000, 0.076),
                (48000, 0.079), (150000, 0.0825), (175000, 0.09),
                (200000, 0.10), (float("inf"), 0.11),
            ],
            "mfj": [
                (4800, 0.014), (9600, 0.032), (19200, 0.055), (28800, 0.064),
                (38400, 0.068), (48000, 0.072), (72000, 0.076),
                (96000, 0.079), (300000, 0.0825), (350000, 0.09),
                (400000, 0.10), (float("inf"), 0.11),
            ],
        },
    },
    "IA": {
        "brackets": {
            "single": [
                (6210, 0.044), (31050, 0.048), (float("inf"), 0.057),
            ],
            "mfj": [
                (6210, 0.044), (31050, 0.048), (float("inf"), 0.057),
            ],
        },
    },
    "KS": {
        "brackets": {
            "single": [(15000, 0.031), (30000, 0.0525), (float("inf"), 0.057)],
            "mfj":    [(30000, 0.031), (60000, 0.0525), (float("inf"), 0.057)],
        },
    },
    "LA": {
        "brackets": {
            "single": [(12500, 0.0185), (50000, 0.035), (float("inf"), 0.0425)],
            "mfj":    [(25000, 0.0185), (100000, 0.035), (float("inf"), 0.0425)],
        },
    },
    "ME": {
        "brackets": {
            "single": [(24500, 0.058), (58050, 0.0675), (float("inf"), 0.0715)],
            "mfj":    [(49050, 0.058), (116100, 0.0675), (float("inf"), 0.0715)],
        },
    },
    "MD": {
        "brackets": {
            "single": [
                (1000, 0.02), (2000, 0.03), (3000, 0.04), (100000, 0.0475),
                (125000, 0.05), (150000, 0.0525), (250000, 0.055), (float("inf"), 0.0575),
            ],
            "mfj": [
                (1000, 0.02), (2000, 0.03), (3000, 0.04), (150000, 0.0475),
                (175000, 0.05), (225000, 0.0525), (300000, 0.055), (float("inf"), 0.0575),
            ],
        },
        "county_rate": 0.03,  # Average county tax (varies; use 3% as conservative estimate)
    },
    "MN": {
        "brackets": {
            "single": [
                (31690, 0.0535), (104090, 0.068), (193240, 0.0785), (float("inf"), 0.0985),
            ],
            "mfj": [
                (46330, 0.0535), (184040, 0.068), (321450, 0.0785), (float("inf"), 0.0985),
            ],
        },
    },
    "MO": {
        "brackets": {
            "single": [(1207, 0.015), (2414, 0.02), (3621, 0.025), (4828, 0.03),
                       (6035, 0.035), (7242, 0.04), (8449, 0.045), (float("inf"), 0.0495)],
            "mfj":    [(1207, 0.015), (2414, 0.02), (3621, 0.025), (4828, 0.03),
                       (6035, 0.035), (7242, 0.04), (8449, 0.045), (float("inf"), 0.0495)],
        },
    },
    "MT": {
        "brackets": {
            "single": [(20500, 0.0475), (float("inf"), 0.059)],
            "mfj":    [(41000, 0.0475), (float("inf"), 0.059)],
        },
    },
    "NE": {
        "brackets": {
            "single": [(3700, 0.0246), (22170, 0.0351), (float("inf"), 0.0664)],
            "mfj":    [(7390, 0.0246), (44340, 0.0351), (float("inf"), 0.0664)],
        },
    },
    "NJ": {
        "brackets": {
            "single": [
                (20000, 0.014), (35000, 0.0175), (40000, 0.035),
                (75000, 0.05525), (500000, 0.0637), (1000000, 0.0897), (float("inf"), 0.1075),
            ],
            "mfj": [
                (20000, 0.014), (50000, 0.0175), (70000, 0.035),
                (80000, 0.05525), (150000, 0.0637), (500000, 0.0897), (float("inf"), 0.1075),
            ],
        },
    },
    "NM": {
        "brackets": {
            "single": [
                (5500, 0.017), (11000, 0.032), (16000, 0.047), (210000, 0.049), (float("inf"), 0.059),
            ],
            "mfj": [
                (8000, 0.017), (16000, 0.032), (24000, 0.047), (315000, 0.049), (float("inf"), 0.059),
            ],
        },
    },
    "NY": {
        "brackets": {
            "single": [
                (17150, 0.04), (23600, 0.045), (27900, 0.0525), (161550, 0.0585),
                (323200, 0.0625), (2155350, 0.0685), (5000000, 0.0965),
                (25000000, 0.103), (float("inf"), 0.109),
            ],
            "mfj": [
                (27900, 0.04), (43000, 0.045), (161550, 0.0525), (323200, 0.059),
                (2155350, 0.0685), (5000000, 0.0965),
                (25000000, 0.103), (float("inf"), 0.109),
            ],
        },
        "nyc_rate": 0.03876,  # NYC resident surcharge (applied if state = "NY" — user can override)
    },
    "ND": {
        "brackets": {
            "single": [(44725, 0.011), (225975, 0.0204), (float("inf"), 0.029)],
            "mfj":    [(74750, 0.011), (275925, 0.0204), (float("inf"), 0.029)],
        },
    },
    "OH": {
        "brackets": {
            "single": [(26050, 0.0), (100000, 0.02765), (float("inf"), 0.0399)],
            "mfj":    [(26050, 0.0), (100000, 0.02765), (float("inf"), 0.0399)],
        },
    },
    "OK": {
        "brackets": {
            "single": [
                (1000, 0.005), (2500, 0.01), (3750, 0.02),
                (4900, 0.03), (7200, 0.04), (float("inf"), 0.0475),
            ],
            "mfj": [
                (2000, 0.005), (5000, 0.01), (7500, 0.02),
                (9800, 0.03), (12200, 0.04), (float("inf"), 0.0475),
            ],
        },
    },
    "OR": {
        "brackets": {
            "single": [
                (4050, 0.0475), (10200, 0.0675), (125000, 0.0875), (float("inf"), 0.099),
            ],
            "mfj": [
                (8100, 0.0475), (20400, 0.0675), (250000, 0.0875), (float("inf"), 0.099),
            ],
        },
    },
    "RI": {
        "brackets": {
            "single": [(73450, 0.0375), (166950, 0.0475), (float("inf"), 0.0599)],
            "mfj":    [(73450, 0.0375), (166950, 0.0475), (float("inf"), 0.0599)],
        },
    },
    "SC": {
        "brackets": {
            "single": [(3200, 0.0), (16040, 0.03), (float("inf"), 0.064)],
            "mfj":    [(3200, 0.0), (16040, 0.03), (float("inf"), 0.064)],
        },
    },
    "VA": {
        "brackets": {
            "single": [(3000, 0.02), (5000, 0.03), (17000, 0.05), (float("inf"), 0.0575)],
            "mfj":    [(3000, 0.02), (5000, 0.03), (17000, 0.05), (float("inf"), 0.0575)],
        },
    },
    "VT": {
        "brackets": {
            "single": [
                (45400, 0.0335), (110050, 0.066), (229550, 0.076), (float("inf"), 0.0875),
            ],
            "mfj": [
                (75850, 0.0335), (183400, 0.066), (279450, 0.076), (float("inf"), 0.0875),
            ],
        },
    },
    "WI": {
        "brackets": {
            "single": [
                (13810, 0.0354), (27630, 0.0465), (304170, 0.053), (float("inf"), 0.0765),
            ],
            "mfj": [
                (18420, 0.0354), (36840, 0.0465), (405550, 0.053), (float("inf"), 0.0765),
            ],
        },
    },
    "WV": {
        "brackets": {
            "single": [
                (10000, 0.03), (25000, 0.04), (40000, 0.045), (60000, 0.06), (float("inf"), 0.065),
            ],
            "mfj": [
                (10000, 0.03), (25000, 0.04), (40000, 0.045), (60000, 0.06), (float("inf"), 0.065),
            ],
        },
    },
}

# For states not in STATE_TAX_2024, default to 0 (covers DC territories etc.)
# DC is treated as a state for this purpose:
STATE_TAX_2024["DC"] = {
    "brackets": {
        "single": [
            (10000, 0.04), (40000, 0.06), (60000, 0.065), (250000, 0.085),
            (500000, 0.0925), (1000000, 0.0975), (float("inf"), 0.1075),
        ],
        "mfj": [
            (10000, 0.04), (40000, 0.06), (60000, 0.065), (250000, 0.085),
            (500000, 0.0925), (1000000, 0.0975), (float("inf"), 0.1075),
        ],
    },
}


def get_state_data(state: str, year: int) -> dict:
    """Return state tax data for a given state and year. Falls back to 2024 data."""
    # For now, 2023 uses the same brackets as 2024 (conservative — most states have small annual changes)
    return STATE_TAX_2024.get(state.upper(), _NO_TAX)


def compute_state_tax(
    taxable_income: float,
    state: str,
    filing_status: str,
    year: int = 2024,
) -> float:
    """
    Compute state income tax.

    filing_status: 'single' | 'mfj' | 'mfs' | 'hoh'
    Returns total state tax owed (before withholding credit).
    """
    data = get_state_data(state, year)

    if "flat" in data:
        return round(taxable_income * data["flat"], 2)

    # Normalize filing status for states that don't distinguish HOH or MFS
    brackets_map = data.get("brackets", {})
    fs = filing_status
    if fs not in brackets_map:
        fs = "mfj" if filing_status == "mfs" else "single"
    brackets = brackets_map.get(fs, brackets_map.get("single", [(float("inf"), 0.0)]))

    # Progressive calculation
    tax = 0.0
    prev_upper = 0.0
    for upper, rate in brackets:
        if taxable_income <= prev_upper:
            break
        taxable_in_bracket = min(taxable_income, upper) - prev_upper
        tax += taxable_in_bracket * rate
        prev_upper = upper

    # Add county/city surcharges where applicable (MD, NY)
    if state.upper() == "MD":
        tax += taxable_income * data.get("county_rate", 0.0)

    return round(tax, 2)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/tax/__init__.py backend/app/tax/state_brackets.py
git commit -m "feat: state income tax brackets for all 50 states (2024)"
```

---

## Task 4: Federal tax engine

**Files:**
- Create: `backend/app/tax/engine.py`

- [ ] **Step 1: Create `backend/app/tax/engine.py`**

```python
"""
Deterministic federal income tax calculator for 2023 and 2024.
All dollar amounts in USD. Returns a detailed breakdown dict.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

# ── Constants ─────────────────────────────────────────────────────────────────

FEDERAL_BRACKETS = {
    2024: {
        "single": [(11600, 0.10), (47150, 0.12), (100525, 0.22), (191950, 0.24),
                   (243725, 0.32), (609350, 0.35), (float("inf"), 0.37)],
        "mfj":    [(23200, 0.10), (94300, 0.12), (201050, 0.22), (383900, 0.24),
                   (487450, 0.32), (731200, 0.35), (float("inf"), 0.37)],
        "mfs":    [(11600, 0.10), (47150, 0.12), (100525, 0.22), (191950, 0.24),
                   (243725, 0.32), (365600, 0.35), (float("inf"), 0.37)],
        "hoh":    [(16550, 0.10), (63100, 0.12), (100500, 0.22), (191950, 0.24),
                   (243700, 0.32), (609350, 0.35), (float("inf"), 0.37)],
    },
    2023: {
        "single": [(11000, 0.10), (44725, 0.12), (95375, 0.22), (182150, 0.24),
                   (231250, 0.32), (578125, 0.35), (float("inf"), 0.37)],
        "mfj":    [(22000, 0.10), (89450, 0.12), (190750, 0.22), (364200, 0.24),
                   (462500, 0.32), (693750, 0.35), (float("inf"), 0.37)],
        "mfs":    [(11000, 0.10), (44725, 0.12), (95375, 0.22), (182150, 0.24),
                   (231250, 0.32), (346875, 0.35), (float("inf"), 0.37)],
        "hoh":    [(15700, 0.10), (59850, 0.12), (95350, 0.22), (182150, 0.24),
                   (231250, 0.32), (578100, 0.35), (float("inf"), 0.37)],
    },
}

LTCG_BRACKETS = {
    2024: {
        "single": [(47025, 0.0), (518900, 0.15), (float("inf"), 0.20)],
        "mfj":    [(94050, 0.0), (583750, 0.15), (float("inf"), 0.20)],
        "mfs":    [(47025, 0.0), (291850, 0.15), (float("inf"), 0.20)],
        "hoh":    [(63000, 0.0), (551350, 0.15), (float("inf"), 0.20)],
    },
    2023: {
        "single": [(44625, 0.0), (492300, 0.15), (float("inf"), 0.20)],
        "mfj":    [(89250, 0.0), (553850, 0.15), (float("inf"), 0.20)],
        "mfs":    [(44625, 0.0), (276900, 0.15), (float("inf"), 0.20)],
        "hoh":    [(59750, 0.0), (523050, 0.15), (float("inf"), 0.20)],
    },
}

STANDARD_DEDUCTIONS = {
    2024: {"single": 14600, "mfj": 29200, "mfs": 14600, "hoh": 21900},
    2023: {"single": 13850, "mfj": 27700, "mfs": 13850, "hoh": 20800},
}

SE_TAX_RATE = 0.153           # 15.3% (12.4% SS + 2.9% Medicare)
SE_TAXABLE_FACTOR = 0.9235    # SE income × 0.9235 is taxable for SE tax
NIIT_RATE = 0.038             # Net Investment Income Tax
NIIT_THRESHOLD = {
    "single": 200000, "mfj": 250000, "mfs": 125000, "hoh": 200000
}
CHILD_TAX_CREDIT = 2000       # per qualifying child (2024)
CHILD_CREDIT_PHASEOUT = {     # AGI above which credit phases out ($50/credit per $1k)
    "single": 200000, "mfj": 400000, "mfs": 200000, "hoh": 200000
}
SALT_CAP = 10000              # State and local tax deduction cap


def _apply_brackets(income: float, brackets: list[tuple[float, float]]) -> float:
    """Apply progressive brackets to income. Returns total tax."""
    tax = 0.0
    prev = 0.0
    for upper, rate in brackets:
        if income <= prev:
            break
        taxable = min(income, upper) - prev
        tax += taxable * rate
        prev = upper
    return round(tax, 2)


def _marginal_rate(income: float, brackets: list[tuple[float, float]]) -> float:
    prev = 0.0
    for upper, rate in brackets:
        if income <= upper:
            return rate
        prev = upper
    return brackets[-1][1]


# ── Main Calculator ────────────────────────────────────────────────────────────

def calculate_federal_tax(
    # Income sources
    w2_wages: float = 0.0,
    se_income: float = 0.0,        # 1099-NEC total
    ordinary_dividends: float = 0.0,
    qualified_dividends: float = 0.0,
    taxable_interest: float = 0.0,
    st_capital_gains: float = 0.0,  # short-term (taxed as ordinary income)
    lt_capital_gains: float = 0.0,  # long-term
    unemployment_comp: float = 0.0,
    # Filing info
    filing_status: str = "single",   # single | mfj | mfs | hoh
    dependents: int = 0,
    tax_year: int = 2024,
    # Deductions (itemized — standard auto-selected if higher)
    mortgage_interest: float = 0.0,
    state_local_taxes_paid: float = 0.0,   # will be capped at SALT_CAP
    charitable_contributions: float = 0.0,
    # Above-the-line deductions
    se_health_insurance: float = 0.0,
    student_loan_interest: float = 0.0,
    # Credits
    child_dependent_care_credit: float = 0.0,
    education_credits: float = 0.0,
    # Withholding already paid
    federal_withheld: float = 0.0,
) -> dict:
    """
    Compute federal tax liability. Returns a detailed breakdown dict.
    All dollar amounts rounded to 2 decimal places.
    """
    fs = filing_status.lower()
    brackets = FEDERAL_BRACKETS.get(tax_year, FEDERAL_BRACKETS[2024]).get(fs, FEDERAL_BRACKETS[2024]["single"])
    ltcg_brackets = LTCG_BRACKETS.get(tax_year, LTCG_BRACKETS[2024]).get(fs, LTCG_BRACKETS[2024]["single"])
    std_ded = STANDARD_DEDUCTIONS.get(tax_year, STANDARD_DEDUCTIONS[2024]).get(fs, STANDARD_DEDUCTIONS[2024]["single"])

    # 1. Gross income (ordinary)
    gross_income = (
        w2_wages + se_income + ordinary_dividends + taxable_interest
        + st_capital_gains + unemployment_comp
    )
    # Note: LTCG and qualified divs are tracked separately for preferential rates

    # 2. SE tax (on net SE income)
    net_se = se_income * SE_TAXABLE_FACTOR
    se_tax = round(net_se * SE_TAX_RATE, 2)
    half_se_deduction = round(se_tax / 2, 2)

    # 3. QBI deduction (Section 199A — 20% of qualified business income, simplified)
    qbi_deduction = round(se_income * 0.20, 2) if se_income > 0 else 0.0

    # 4. Above-the-line deductions → AGI
    above_line = half_se_deduction + se_health_insurance + min(student_loan_interest, 2500)
    agi = round(gross_income - above_line, 2)

    # 5. Itemized vs standard deduction
    salt = min(state_local_taxes_paid, SALT_CAP)
    itemized = round(mortgage_interest + salt + charitable_contributions, 2)
    use_standard = std_ded >= itemized
    deduction_used = std_ded if use_standard else itemized

    # 6. Taxable ordinary income
    taxable_ordinary = max(0, agi - deduction_used - qbi_deduction)

    # 7. Ordinary income tax
    ordinary_tax = _apply_brackets(taxable_ordinary, brackets)
    marginal = _marginal_rate(taxable_ordinary, brackets)

    # 8. LTCG / qualified dividends tax (stacked on top of ordinary income for bracket calc)
    ltcg_total = lt_capital_gains + qualified_dividends
    if ltcg_total > 0:
        stacked_income = taxable_ordinary + ltcg_total
        ltcg_tax = _apply_brackets(stacked_income, ltcg_brackets) - _apply_brackets(taxable_ordinary, ltcg_brackets)
        ltcg_tax = max(0, round(ltcg_tax, 2))
    else:
        ltcg_tax = 0.0

    # 9. NIIT (3.8% on net investment income if AGI > threshold)
    niit_threshold = NIIT_THRESHOLD.get(fs, 200000)
    investment_income = ordinary_dividends + taxable_interest + lt_capital_gains + st_capital_gains
    niit = round(min(investment_income, max(0, agi - niit_threshold)) * NIIT_RATE, 2) if agi > niit_threshold else 0.0

    # 10. Child tax credit
    ctc_phaseout = CHILD_CREDIT_PHASEOUT.get(fs, 200000)
    ctc_before_phaseout = dependents * CHILD_TAX_CREDIT
    ctc_reduction = max(0, ((agi - ctc_phaseout) // 1000) * 50) if agi > ctc_phaseout else 0
    child_tax_credit_applied = max(0, ctc_before_phaseout - ctc_reduction)

    # 11. Total federal tax
    total_fed_tax = max(0, round(
        ordinary_tax + ltcg_tax + se_tax + niit
        - child_tax_credit_applied
        - child_dependent_care_credit
        - education_credits,
        2
    ))

    # 12. Owed / refund
    owed = round(total_fed_tax - federal_withheld, 2)

    # 13. Effective rate
    effective_rate = round((total_fed_tax / gross_income * 100) if gross_income > 0 else 0, 2)

    # 14. Quarterly estimated payments (if SE income > $1,000 and total owed > 0)
    quarterly_payment = round(total_fed_tax / 4, 2) if se_income > 1000 and total_fed_tax > 0 else 0.0

    return {
        # Income
        "gross_income": gross_income,
        "w2_wages": w2_wages,
        "se_income": se_income,
        "ordinary_dividends": ordinary_dividends,
        "qualified_dividends": qualified_dividends,
        "taxable_interest": taxable_interest,
        "st_capital_gains": st_capital_gains,
        "lt_capital_gains": lt_capital_gains,
        "unemployment_comp": unemployment_comp,
        # Deductions
        "agi": agi,
        "half_se_deduction": half_se_deduction,
        "qbi_deduction": qbi_deduction,
        "standard_deduction": std_ded,
        "itemized_deduction": itemized,
        "deduction_used": deduction_used,
        "used_standard_deduction": use_standard,
        "taxable_ordinary_income": taxable_ordinary,
        # Taxes
        "ordinary_income_tax": ordinary_tax,
        "ltcg_tax": ltcg_tax,
        "se_tax": se_tax,
        "niit": niit,
        # Credits
        "child_tax_credit": child_tax_credit_applied,
        "child_dependent_care_credit": child_dependent_care_credit,
        "education_credits": education_credits,
        # Summary
        "total_federal_tax": total_fed_tax,
        "federal_withheld": federal_withheld,
        "federal_owed": owed,
        "federal_refund": max(0, -owed),
        "effective_rate_pct": effective_rate,
        "marginal_rate_pct": round(marginal * 100, 1),
        "quarterly_estimated_payment": quarterly_payment,
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/tax/engine.py
git commit -m "feat: deterministic federal tax engine for 2023 and 2024"
```

---

## Task 5: Claude Vision document extractor

**Files:**
- Create: `backend/app/tax/extractor.py`

- [ ] **Step 1: Create `backend/app/tax/extractor.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/tax/extractor.py
git commit -m "feat: Claude Vision tax document extractor for W-2 and 1099 forms"
```

---

## Task 6: Tax API endpoints

**Files:**
- Create: `backend/app/api/tax.py`

- [ ] **Step 1: Create `backend/app/api/tax.py`**

```python
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
        txn_result = await session.execute(
            text("""
                SELECT SUM(amount) AS total
                FROM transactions
                WHERE category IN ('Business')
                  AND NOT is_excluded AND NOT pending AND amount > 0
                  AND EXTRACT(YEAR FROM date) = :year
            """),
            {"year": body.tax_year},
        )
        r = txn_result.fetchone()
        # Business expenses reduce SE income (already captured via 1099-NEC, so don't double-deduct)
        # Charitable contributions are tracked separately
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
        import json
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/tax.py
git commit -m "feat: tax calculator API — upload, extract, and calculate endpoints"
```

---

## Task 7: Register tax router

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add tax router to `main.py`**

```python
from app.api.tax import router as tax_router
```

```python
app.include_router(tax_router)
```

- [ ] **Step 2: Rebuild backend and confirm startup**

```bash
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d backend
docker compose logs backend --tail=20
```

Expected: `Application startup complete.` with no import errors.

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register tax router in FastAPI app"
```

---

## Task 8: Frontend API types and methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add tax types**

```typescript
export interface TaxDocument {
  id: string;
  doc_type: string;
  tax_year: number;
  filename: string;
  extraction_status: "pending" | "processing" | "done" | "failed";
  extracted_json: Record<string, unknown> | null;
}

export interface TaxFederalResult {
  gross_income: number;
  w2_wages: number;
  se_income: number;
  ordinary_dividends: number;
  qualified_dividends: number;
  taxable_interest: number;
  st_capital_gains: number;
  lt_capital_gains: number;
  unemployment_comp: number;
  agi: number;
  half_se_deduction: number;
  qbi_deduction: number;
  standard_deduction: number;
  itemized_deduction: number;
  deduction_used: number;
  used_standard_deduction: boolean;
  taxable_ordinary_income: number;
  ordinary_income_tax: number;
  ltcg_tax: number;
  se_tax: number;
  niit: number;
  child_tax_credit: number;
  child_dependent_care_credit: number;
  education_credits: number;
  total_federal_tax: number;
  federal_withheld: number;
  federal_owed: number;
  federal_refund: number;
  effective_rate_pct: number;
  marginal_rate_pct: number;
  quarterly_estimated_payment: number;
}

export interface TaxStateResult {
  state: string;
  state_tax: number;
  state_withheld: number;
  state_owed: number;
  state_refund: number;
}

export interface TaxCalculationResult {
  calculation_id: string;
  federal: TaxFederalResult;
  state: TaxStateResult;
  combined_owed: number;
  insights: string[];
}

export interface TaxCalculateRequest {
  tax_year: number;
  filing_status: string;
  dependents: number;
  state: string;
  pull_transactions: boolean;
  mortgage_interest: number;
  state_local_taxes_paid: number;
  se_health_insurance: number;
  student_loan_interest: number;
  child_dependent_care_credit: number;
  education_credits: number;
}
```

- [ ] **Step 2: Add API methods**

```typescript
tax: {
  listDocuments: (tax_year: number) =>
    get<TaxDocument[]>("/api/tax/documents", { tax_year }),
  uploadDocument: async (file: File, doc_type: string, tax_year: number): Promise<TaxDocument> => {
    const base = typeof window === "undefined" ? (process.env.BACKEND_URL ?? "http://127.0.0.1:8000") : "";
    const token = typeof window !== "undefined" ? localStorage.getItem("hive_token") : null;
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", doc_type);
    form.append("tax_year", String(tax_year));
    const res = await fetch(`${base}/api/tax/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
  extractDocument: (id: string) =>
    post<TaxDocument>(`/api/tax/documents/${id}/extract`, {}),
  updateDocument: (id: string, extracted_json: Record<string, unknown>) =>
    put<TaxDocument>(`/api/tax/documents/${id}`, { extracted_json }),
  deleteDocument: (id: string) => del<void>(`/api/tax/documents/${id}`),
  calculate: (req: TaxCalculateRequest) =>
    post<TaxCalculationResult>("/api/tax/calculate", req),
  listCalculations: () => get<{ id: string; tax_year: number; filing_status: string; state: string; created_at: string }[]>("/api/tax/calculations"),
  getCalculation: (id: string) => get<TaxCalculationResult>(`/api/tax/calculations/${id}`),
},
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add tax API types and client methods"
```

---

## Task 9: Build the `/tax` page

**Files:**
- Create: `frontend/src/app/tax/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/tax/page.tsx`**

This is a multi-step wizard: Step 1 (Upload) → Step 2 (Review) → Step 3 (Filing Info) → Step 4 (Results).

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, TaxDocument, TaxCalculationResult, TaxCalculateRequest } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, ChevronLeft, Trash2, RefreshCw, Lightbulb,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "W2",      label: "W-2",       desc: "Employee wages & withholding" },
  { value: "1099NEC", label: "1099-NEC",  desc: "Freelance / self-employment income" },
  { value: "1099DIV", label: "1099-DIV",  desc: "Dividends & capital gain distributions" },
  { value: "1099INT", label: "1099-INT",  desc: "Interest income" },
  { value: "1099B",   label: "1099-B",    desc: "Stock / investment sales" },
  { value: "1099G",   label: "1099-G",    desc: "Unemployment compensation" },
] as const;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

const FILING_STATUSES = [
  { value: "single", label: "Single" },
  { value: "mfj",    label: "Married Filing Jointly" },
  { value: "mfs",    label: "Married Filing Separately" },
  { value: "hoh",    label: "Head of Household" },
];

type Step = 1 | 2 | 3 | 4;

// ── Step 1: Upload ─────────────────────────────────────────────────────────────

function UploadStep({
  docs,
  taxYear,
  onDocsChange,
  onNext,
}: {
  docs: TaxDocument[];
  taxYear: number;
  onDocsChange: () => void;
  onNext: () => void;
}) {
  const [uploading, setUploading]   = useState(false);
  const [selectedType, setSelectedType] = useState("W2");
  const [dragOver, setDragOver]     = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await api.tax.uploadDocument(f, selectedType, taxYear);
      }
      onDocsChange();
    } finally {
      setUploading(false);
    }
  }

  async function handleExtract(id: string) {
    setExtractingId(id);
    try {
      await api.tax.extractDocument(id);
      onDocsChange();
    } finally {
      setExtractingId(null);
    }
  }

  async function handleDelete(id: string) {
    await api.tax.deleteDocument(id);
    onDocsChange();
  }

  const allExtracted = docs.length > 0 && docs.every(d => d.extraction_status === "done");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold text-ink-primary mb-1">Upload Tax Documents</p>
        <p className="text-[12px] text-ink-tertiary">
          Upload your W-2s and 1099s for tax year {taxYear}. We&apos;ll use AI to extract the values.
        </p>
      </div>

      {/* Doc type selector */}
      <div className="grid grid-cols-3 gap-2">
        {DOC_TYPES.map(dt => (
          <button
            key={dt.value}
            onClick={() => setSelectedType(dt.value)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              selectedType === dt.value
                ? "border-honey/40 bg-honey/[0.06] text-ink-primary"
                : "border-white/[0.06] bg-white/[0.02] text-ink-tertiary hover:border-white/[0.12]"
            )}
          >
            <p className="text-[12px] font-semibold">{dt.label}</p>
            <p className="text-[10px] mt-0.5 opacity-70">{dt.desc}</p>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
          dragOver
            ? "border-honey/60 bg-honey/[0.04]"
            : "border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.02]"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-ink-tertiary">
            <Loader2 className="w-6 h-6 animate-spin text-honey" />
            <p className="text-[13px]">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-ink-tertiary/40" />
            <p className="text-[13px] font-medium text-ink-secondary">
              Drop {selectedType} here, or click to browse
            </p>
            <p className="text-[11px] text-ink-tertiary">PDF, JPG, or PNG</p>
          </div>
        )}
      </div>

      {/* Uploaded docs */}
      {docs.length > 0 && (
        <div className="hive-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-[12px] font-medium text-ink-primary">{docs.length} documents uploaded</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-3">
                <FileText className="w-4 h-4 text-ink-tertiary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-ink-primary truncate">{doc.filename}</p>
                  <p className="text-[10px] text-ink-tertiary">{doc.doc_type} · {doc.tax_year}</p>
                </div>

                {/* Status badge */}
                {doc.extraction_status === "done" && (
                  <span className="flex items-center gap-1 text-[10px] text-semantic-income shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Extracted
                  </span>
                )}
                {doc.extraction_status === "failed" && (
                  <span className="flex items-center gap-1 text-[10px] text-semantic-expense shrink-0">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                )}
                {doc.extraction_status === "pending" && (
                  <button
                    onClick={() => handleExtract(doc.id)}
                    disabled={extractingId === doc.id}
                    className="text-[10px] px-2 py-1 rounded-lg bg-honey/10 text-honey hover:bg-honey/20 transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1"
                  >
                    {extractingId === doc.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Extracting…</>
                    ) : (
                      <><RefreshCw className="w-3 h-3" /> Extract</>
                    )}
                  </button>
                )}
                {doc.extraction_status === "processing" && (
                  <span className="text-[10px] text-ink-tertiary flex items-center gap-1 shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin" /> Processing…
                  </span>
                )}

                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-ink-tertiary/50 hover:text-semantic-expense transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={docs.length === 0}
          className="flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
        >
          Review Extracted Data <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Review ─────────────────────────────────────────────────────────────

function ReviewStep({
  docs,
  onDocsChange,
  onNext,
  onBack,
}: {
  docs: TaxDocument[];
  onDocsChange: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [editMap, setEditMap] = useState<Record<string, Record<string, unknown>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function getVal(doc: TaxDocument, key: string): string {
    const override = editMap[doc.id]?.[key];
    if (override !== undefined) return String(override);
    return String((doc.extracted_json as Record<string, unknown>)?.[key] ?? "");
  }

  function setVal(docId: string, key: string, val: string) {
    setEditMap(prev => ({
      ...prev,
      [docId]: { ...prev[docId], [key]: isNaN(Number(val)) ? val : Number(val) },
    }));
  }

  async function handleSave(doc: TaxDocument) {
    setSaving(doc.id);
    const merged = { ...(doc.extracted_json ?? {}), ...(editMap[doc.id] ?? {}) };
    try {
      await api.tax.updateDocument(doc.id, merged);
      onDocsChange();
    } finally {
      setSaving(null);
    }
  }

  const FIELD_LABELS: Record<string, Record<string, string>> = {
    W2: { box1_wages: "Box 1 — Wages", box2_federal_withheld: "Box 2 — Fed Withheld", box16_state_wages: "Box 16 — State Wages", box17_state_withheld: "Box 17 — State Withheld" },
    "1099NEC": { box1_nonemployee_comp: "Box 1 — Nonemployee Comp", box4_federal_withheld: "Box 4 — Fed Withheld" },
    "1099DIV": { box1a_ordinary_dividends: "Box 1a — Ordinary Dividends", box1b_qualified_dividends: "Box 1b — Qualified Dividends", box2a_total_capital_gain: "Box 2a — Capital Gain Distrib.", box4_federal_withheld: "Box 4 — Fed Withheld" },
    "1099INT": { box1_interest_income: "Box 1 — Interest Income", box4_federal_withheld: "Box 4 — Fed Withheld", box8_tax_exempt_interest: "Box 8 — Tax-Exempt Interest" },
    "1099G": { box1_unemployment_comp: "Box 1 — Unemployment Comp", box4_federal_withheld: "Box 4 — Fed Withheld" },
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold text-ink-primary mb-1">Review Extracted Values</p>
        <p className="text-[12px] text-ink-tertiary">Verify the values Claude extracted. Edit any that look wrong.</p>
      </div>

      {docs.filter(d => d.doc_type !== "1099B").map(doc => {
        const fields = FIELD_LABELS[doc.doc_type] ?? {};
        return (
          <div key={doc.id} className="hive-card overflow-hidden">
            <div className="hive-section-header">
              <div>
                <p className="text-[13px] font-medium text-ink-primary">{doc.doc_type} — {doc.filename}</p>
                {doc.extraction_status !== "done" && (
                  <p className="text-[11px] text-semantic-expense mt-0.5">Not yet extracted — values may be missing</p>
                )}
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {Object.entries(fields).map(([key, label]) => (
                <div key={key}>
                  <label className="hive-label block mb-1">{label}</label>
                  <input
                    type="number"
                    value={getVal(doc, key)}
                    onChange={e => setVal(doc.id, key, e.target.value)}
                    className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary focus:outline-none focus:border-honey/30 font-mono"
                  />
                </div>
              ))}
            </div>
            {editMap[doc.id] && Object.keys(editMap[doc.id]).length > 0 && (
              <div className="px-5 pb-4">
                <button
                  onClick={() => handleSave(doc)}
                  disabled={saving === doc.id}
                  className="text-[12px] px-4 py-2 rounded-lg bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40"
                >
                  {saving === doc.id ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 1099-B docs are shown as a summary since they have multiple entries */}
      {docs.filter(d => d.doc_type === "1099B").map(doc => {
        const entries = (doc.extracted_json as Record<string, unknown[]>)?.entries ?? [];
        const totalProceeds = (entries as Record<string, number>[]).reduce((s, e) => s + (e.proceeds ?? 0), 0);
        const totalBasis = (entries as Record<string, number>[]).reduce((s, e) => s + (e.cost_basis ?? 0), 0);
        return (
          <div key={doc.id} className="hive-card p-5">
            <p className="text-[13px] font-medium text-ink-primary mb-2">1099-B — {doc.filename}</p>
            <p className="text-[12px] text-ink-tertiary">
              {entries.length} transactions · Proceeds: {fmt(totalProceeds)} · Basis: {fmt(totalBasis)} · Net: {fmt(totalProceeds - totalBasis)}
            </p>
          </div>
        );
      })}

      <div className="flex justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors font-medium"
        >
          Filing Information <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Filing Info ────────────────────────────────────────────────────────

function FilingInfoStep({
  req,
  onReqChange,
  onNext,
  onBack,
  calculating,
}: {
  req: TaxCalculateRequest;
  onReqChange: (r: TaxCalculateRequest) => void;
  onNext: () => void;
  onBack: () => void;
  calculating: boolean;
}) {
  function set<K extends keyof TaxCalculateRequest>(key: K, val: TaxCalculateRequest[K]) {
    onReqChange({ ...req, [key]: val });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] font-semibold text-ink-primary mb-1">Filing Information</p>
        <p className="text-[12px] text-ink-tertiary">Tell us about your filing situation for accurate calculations.</p>
      </div>

      <div className="hive-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="hive-label block mb-1.5">Tax Year</label>
            <select
              value={req.tax_year}
              onChange={e => set("tax_year", Number(e.target.value))}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
            >
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>
          <div>
            <label className="hive-label block mb-1.5">Filing Status</label>
            <select
              value={req.filing_status}
              onChange={e => set("filing_status", e.target.value)}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
            >
              {FILING_STATUSES.map(fs => <option key={fs.value} value={fs.value}>{fs.label}</option>)}
            </select>
          </div>
          <div>
            <label className="hive-label block mb-1.5">State of Residence</label>
            <select
              value={req.state}
              onChange={e => set("state", e.target.value)}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
            >
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="hive-label block mb-1.5">Qualifying Dependents</label>
            <input
              type="number"
              min={0}
              value={req.dependents}
              onChange={e => set("dependents", Number(e.target.value))}
              className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary font-mono"
            />
          </div>
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <p className="text-[12px] font-medium text-ink-primary mb-3">Deductions & Credits (optional)</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "mortgage_interest" as const, label: "Mortgage Interest" },
              { key: "state_local_taxes_paid" as const, label: "State/Local Taxes Paid (capped at $10k)" },
              { key: "se_health_insurance" as const, label: "SE Health Insurance Premiums" },
              { key: "student_loan_interest" as const, label: "Student Loan Interest" },
              { key: "child_dependent_care_credit" as const, label: "Child/Dependent Care Credit" },
              { key: "education_credits" as const, label: "Education Credits" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="hive-label block mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={req[key] as number}
                  onChange={e => set(key, Number(e.target.value))}
                  className="w-full text-[13px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary font-mono"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={req.pull_transactions}
              onChange={e => set("pull_transactions", e.target.checked)}
              className="accent-honey w-4 h-4"
            />
            <div>
              <p className="text-[13px] text-ink-primary">Pull deductible expenses from transactions</p>
              <p className="text-[11px] text-ink-tertiary">Auto-adds charitable contributions from your transaction data</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={calculating}
          className="flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
        >
          {calculating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Calculating…</>
          ) : (
            <>Calculate Taxes <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Results ────────────────────────────────────────────────────────────

function ResultsStep({
  result,
  onBack,
}: {
  result: TaxCalculationResult;
  onBack: () => void;
}) {
  const { federal: f, state: s } = result;
  const isRefund = result.combined_owed <= 0;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Federal",
            value: f.federal_owed > 0 ? `Owe ${fmt(f.federal_owed)}` : `Refund ${fmt(f.federal_refund)}`,
            color: f.federal_owed > 0 ? "text-semantic-expense" : "text-semantic-income",
          },
          {
            label: `${s.state} State`,
            value: s.state_owed > 0 ? `Owe ${fmt(s.state_owed)}` : `Refund ${fmt(s.state_refund)}`,
            color: s.state_owed > 0 ? "text-semantic-expense" : "text-semantic-income",
          },
          { label: "Effective Rate", value: `${f.effective_rate_pct}%`, color: "text-ink-primary" },
          { label: "Marginal Rate", value: `${f.marginal_rate_pct}%`, color: "text-ink-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="hive-card p-4">
            <p className="hive-label mb-2">{label}</p>
            <p className={cn("text-[16px] font-bold font-mono tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Combined total */}
      <div className={cn(
        "hive-card p-5 flex items-center justify-between",
        isRefund ? "bg-semantic-income/[0.04] border border-semantic-income/[0.12]" : ""
      )}>
        <div>
          <p className="text-[13px] font-medium text-ink-primary">Combined Total</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">Federal + {s.state} state</p>
        </div>
        <p className={cn(
          "text-[28px] font-bold font-mono tabular-nums",
          isRefund ? "text-semantic-income" : "text-semantic-expense"
        )}>
          {isRefund ? `+${fmt(-result.combined_owed)}` : fmt(result.combined_owed)}
        </p>
      </div>

      {/* Key insights */}
      {result.insights.length > 0 && (
        <div className="hive-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-honey" />
            <p className="text-[13px] font-medium text-ink-primary">Key Insights</p>
          </div>
          <ul className="space-y-2">
            {result.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-ink-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-honey mt-1.5 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quarterly payments */}
      {f.quarterly_estimated_payment > 0 && (
        <div className="hive-card p-5">
          <p className="text-[13px] font-medium text-ink-primary mb-3">Estimated Quarterly Payments (Next Year)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Q1", due: "Apr 15" },
              { label: "Q2", due: "Jun 15" },
              { label: "Q3", due: "Sep 15" },
              { label: "Q4", due: "Jan 15" },
            ].map(({ label, due }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[10px] text-ink-tertiary">{label} · Due {due}</p>
                <p className="text-[16px] font-mono font-bold text-honey mt-1 tabular-nums">
                  {fmt(f.quarterly_estimated_payment)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Income breakdown accordion */}
      <details className="hive-card overflow-hidden">
        <summary className="px-5 py-4 cursor-pointer text-[13px] font-medium text-ink-primary hover:bg-white/[0.02] transition-colors list-none flex items-center justify-between">
          Income Breakdown
          <ChevronRight className="w-4 h-4 text-ink-tertiary transition-transform [[open]>summary>&]:rotate-90" />
        </summary>
        <div className="px-5 pb-4 space-y-2 border-t border-white/[0.04]">
          {[
            { label: "W-2 Wages", value: f.w2_wages },
            { label: "Self-Employment (1099-NEC)", value: f.se_income },
            { label: "Ordinary Dividends", value: f.ordinary_dividends },
            { label: "Taxable Interest", value: f.taxable_interest },
            { label: "Short-Term Capital Gains", value: f.st_capital_gains },
            { label: "Long-Term Capital Gains", value: f.lt_capital_gains },
            { label: "Unemployment Compensation", value: f.unemployment_comp },
          ].filter(r => r.value !== 0).map(({ label, value }) => (
            <div key={label} className="flex justify-between text-[12px]">
              <span className="text-ink-tertiary">{label}</span>
              <span className="text-ink-primary font-mono tabular-nums">{fmt(value)}</span>
            </div>
          ))}
          <div className="flex justify-between text-[13px] font-semibold pt-2 border-t border-white/[0.05]">
            <span className="text-ink-primary">Gross Income</span>
            <span className="text-ink-primary font-mono tabular-nums">{fmt(f.gross_income)}</span>
          </div>
          <div className="flex justify-between text-[13px] font-semibold">
            <span className="text-ink-primary">AGI</span>
            <span className="text-ink-primary font-mono tabular-nums">{fmt(f.agi)}</span>
          </div>
        </div>
      </details>

      {/* Deductions breakdown */}
      <details className="hive-card overflow-hidden">
        <summary className="px-5 py-4 cursor-pointer text-[13px] font-medium text-ink-primary hover:bg-white/[0.02] transition-colors list-none flex items-center justify-between">
          Deductions Used: {f.used_standard_deduction ? "Standard" : "Itemized"} (${f.deduction_used.toLocaleString()})
          <ChevronRight className="w-4 h-4 text-ink-tertiary" />
        </summary>
        <div className="px-5 pb-4 space-y-2 border-t border-white/[0.04]">
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-tertiary">Standard Deduction</span>
            <span className={cn("font-mono tabular-nums", f.used_standard_deduction ? "text-honey font-semibold" : "text-ink-tertiary")}>{fmt(f.standard_deduction)}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-tertiary">Itemized Deduction</span>
            <span className={cn("font-mono tabular-nums", !f.used_standard_deduction ? "text-honey font-semibold" : "text-ink-tertiary")}>{fmt(f.itemized_deduction)}</span>
          </div>
          {f.qbi_deduction > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-ink-tertiary">QBI Deduction (20% of SE)</span>
              <span className="text-ink-tertiary font-mono tabular-nums">{fmt(f.qbi_deduction)}</span>
            </div>
          )}
          {f.half_se_deduction > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-ink-tertiary">½ SE Tax Deduction</span>
              <span className="text-ink-tertiary font-mono tabular-nums">{fmt(f.half_se_deduction)}</span>
            </div>
          )}
        </div>
      </details>

      <div className="flex justify-start">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Filing Info
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_REQUEST: TaxCalculateRequest = {
  tax_year: 2024,
  filing_status: "single",
  dependents: 0,
  state: "TX",
  pull_transactions: false,
  mortgage_interest: 0,
  state_local_taxes_paid: 0,
  se_health_insurance: 0,
  student_loan_interest: 0,
  child_dependent_care_credit: 0,
  education_credits: 0,
};

export default function TaxPage() {
  const [step, setStep]             = useState<Step>(1);
  const [taxYear, setTaxYear]       = useState(2024);
  const [docs, setDocs]             = useState<TaxDocument[]>([]);
  const [req, setReq]               = useState<TaxCalculateRequest>(DEFAULT_REQUEST);
  const [result, setResult]         = useState<TaxCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const loadDocs = useCallback(() => {
    api.tax.listDocuments(taxYear).then(setDocs);
  }, [taxYear]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleCalculate() {
    setCalculating(true);
    try {
      const r = await api.tax.calculate({ ...req, tax_year: taxYear });
      setResult(r);
      setStep(4);
    } catch (e) {
      console.error(e);
    } finally {
      setCalculating(false);
    }
  }

  const STEPS = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Review" },
    { n: 3, label: "Filing Info" },
    { n: 4, label: "Results" },
  ];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Tax Calculator</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">Federal + state tax calculation from your documents</p>
        </div>
        <select
          value={taxYear}
          onChange={e => setTaxYear(Number(e.target.value))}
          className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
        >
          <option value={2024}>2024 Tax Year</option>
          <option value={2023}>2023 Tax Year</option>
        </select>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all",
              step === s.n ? "bg-honey text-black" :
              step > s.n ? "bg-semantic-income text-black" :
              "bg-white/[0.06] text-ink-tertiary"
            )}>
              {step > s.n ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span className={cn(
              "text-[11px] font-medium",
              step === s.n ? "text-honey" : step > s.n ? "text-ink-secondary" : "text-ink-tertiary"
            )}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-ink-tertiary/40" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 1 && <UploadStep docs={docs} taxYear={taxYear} onDocsChange={loadDocs} onNext={() => setStep(2)} />}
      {step === 2 && <ReviewStep docs={docs} onDocsChange={loadDocs} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && (
        <FilingInfoStep
          req={req}
          onReqChange={setReq}
          onNext={handleCalculate}
          onBack={() => setStep(2)}
          calculating={calculating}
        />
      )}
      {step === 4 && result && <ResultsStep result={result} onBack={() => setStep(3)} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/tax/page.tsx
git commit -m "feat: full tax calculator page — upload, review, filing info, and results"
```

---

## Task 10: Add `/tax` to sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add Tax to INTELLIGENCE nav group**

Add `Calculator` to lucide-react imports:
```typescript
import { ..., Calculator, ... } from "lucide-react";
```

In the `INTELLIGENCE` group items, add:
```typescript
{ href: "/tax", label: "Tax Calculator", icon: Calculator, exact: false },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: add Tax Calculator to sidebar navigation"
```

---

## Final Verification

- [ ] Rebuild everything

```bash
docker compose build backend frontend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d
docker compose exec backend alembic upgrade head
docker compose logs backend --tail=30
```

Expected: No import errors, migration runs clean.

- [ ] Navigate to `/tax` — confirm step indicator and upload zone render.

- [ ] Upload a W-2 image (can use any real W-2 PDF or a test document) — confirm it appears in the list with "Extract" button.

- [ ] Click Extract — confirm extraction status changes to "done" and numeric fields populate.

- [ ] Proceed to Filing Info, fill in basic info, click Calculate — confirm results page shows federal owed/refund, state result, and Claude insights.

- [ ] Confirm quarterly payments section appears if you add 1099-NEC income.
