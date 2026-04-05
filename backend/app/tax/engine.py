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
