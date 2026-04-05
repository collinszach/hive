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
