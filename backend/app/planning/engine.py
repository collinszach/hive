"""Pure, DB-independent financial projection engine (Epic 8, Phase 1).

The engine projects net worth month by month from an explicit set of inputs. It is intentionally
free of any database or framework dependency so it can be unit-tested in isolation and reused by the
API layer, scenarios (Epic 9), and the AI advisor (Epic 10).

Model, per month:
  1. Investments grow by the monthly-equivalent of the annual return (compounding on prior balance).
  2. Cash changes by (income net of tax) − (expenses, inflated).
  3. Events land on the months they recur in (inflow adds, outflow subtracts) against cash or investments.
  4. Optionally, cash above the emergency floor is swept into investments.

Confidence bands re-run only the investment growth rate at ±band_spread; cash flows are identical across
bands, so net-worth bands differ only by investment compounding (documented, deterministic, no RNG).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

Recurrence = str  # "once" | "monthly" | "quarterly" | "semiannual" | "annual"
EventKind = str   # "inflow" | "outflow"
Target = str      # "cash" | "investment"


# ── Inputs ───────────────────────────────────────────────────────────────────

@dataclass
class Assumptions:
    annual_return_pct: float = 6.0       # nominal annual return on invested balance
    annual_inflation_pct: float = 3.0    # expense growth
    effective_tax_rate_pct: float = 0.0  # applied to taxable income streams
    emergency_floor: float = 0.0         # min cash kept; surplus may sweep to investments
    auto_invest_surplus: bool = False    # sweep cash above the floor into investments each month
    band_spread_pct: float = 3.0         # ± on annual return for low/high confidence bands


@dataclass
class IncomeStream:
    monthly_amount: float
    start_month: int = 1            # 1-based index into the projection horizon
    end_month: int | None = None   # inclusive; None = runs through the horizon
    growth_pct: float = 0.0         # annual growth (e.g. raises), compounded from start_month
    taxable: bool = True
    name: str = ""


@dataclass
class PlanEventInput:
    amount: float                  # always positive; direction comes from `kind`
    kind: EventKind = "outflow"
    target: Target = "cash"
    start_month: int = 1
    end_month: int | None = None   # inclusive; None = single hit for "once", else through horizon
    recurrence: Recurrence = "once"
    growth_pct: float = 0.0         # annual growth applied to the amount, compounded from start_month
    name: str = ""


@dataclass
class ProjectionInputs:
    horizon_months: int
    start_date: date                       # first projected month is start_date + 1 month
    starting_cash: float
    starting_investments: float
    base_monthly_expenses: float
    assumptions: Assumptions = field(default_factory=Assumptions)
    income_streams: list[IncomeStream] = field(default_factory=list)
    events: list[PlanEventInput] = field(default_factory=list)


# ── Outputs ──────────────────────────────────────────────────────────────────

@dataclass
class AppliedEvent:
    name: str
    amount: float   # signed, after growth (negative for outflow)
    target: Target


@dataclass
class MonthPoint:
    month: int
    date: str       # ISO first-of-month
    income: float
    expenses: float
    cash: float
    investments: float
    net_worth: float
    net_worth_low: float
    net_worth_high: float
    events: list[AppliedEvent]


@dataclass
class ProjectionResult:
    points: list[MonthPoint]
    final_net_worth: float
    min_cash: float
    min_cash_month: int          # 1-based month index of the cash-runway trough
    min_cash_date: str
    total_income: float
    total_expenses: float


# ── Helpers ──────────────────────────────────────────────────────────────────

def add_months(d: date, n: int) -> date:
    """Return `d` advanced by `n` months, clamped to the first of that month."""
    total = (d.year * 12 + (d.month - 1)) + n
    year, month = divmod(total, 12)
    return date(year, month + 1, 1)


def _monthly_rate(annual_pct: float) -> float:
    return (1.0 + annual_pct / 100.0) ** (1.0 / 12.0) - 1.0


def _grown(amount: float, growth_pct: float, months_since_start: int) -> float:
    if growth_pct == 0.0:
        return amount
    return amount * (1.0 + growth_pct / 100.0) ** (months_since_start / 12.0)


def _stream_active(s: IncomeStream, m: int) -> bool:
    if m < s.start_month:
        return False
    if s.end_month is not None and m > s.end_month:
        return False
    return True


def _event_hits(ev: PlanEventInput, m: int) -> bool:
    if m < ev.start_month:
        return False
    if ev.recurrence == "once":
        return m == ev.start_month
    if ev.end_month is not None and m > ev.end_month:
        return False
    offset = m - ev.start_month
    if ev.recurrence == "monthly":
        return True
    if ev.recurrence == "quarterly":
        return offset % 3 == 0
    if ev.recurrence == "semiannual":
        return offset % 6 == 0
    if ev.recurrence == "annual":
        return offset % 12 == 0
    raise ValueError(f"unknown recurrence: {ev.recurrence!r}")


# ── Engine ───────────────────────────────────────────────────────────────────

def project(inp: ProjectionInputs) -> ProjectionResult:
    a = inp.assumptions
    r_exp = _monthly_rate(a.annual_return_pct)
    r_low = _monthly_rate(max(a.annual_return_pct - a.band_spread_pct, -100.0))
    r_high = _monthly_rate(a.annual_return_pct + a.band_spread_pct)

    cash = float(inp.starting_cash)
    inv_exp = float(inp.starting_investments)
    inv_low = float(inp.starting_investments)
    inv_high = float(inp.starting_investments)

    points: list[MonthPoint] = []
    total_income = 0.0
    total_expenses = 0.0
    min_cash = cash
    min_cash_month = 0
    min_cash_date = inp.start_date.isoformat()

    for m in range(1, inp.horizon_months + 1):
        month_date = add_months(inp.start_date, m)

        # 1. Investments compound on the prior balance.
        inv_exp *= 1.0 + r_exp
        inv_low *= 1.0 + r_low
        inv_high *= 1.0 + r_high

        # 2. Income (net of tax) and inflated expenses flow through cash.
        income = 0.0
        for s in inp.income_streams:
            if _stream_active(s, m):
                amt = _grown(s.monthly_amount, s.growth_pct, m - s.start_month)
                if s.taxable:
                    amt *= 1.0 - a.effective_tax_rate_pct / 100.0
                income += amt
        expenses = inp.base_monthly_expenses * (
            1.0 + a.annual_inflation_pct / 100.0
        ) ** ((m - 1) / 12.0)
        cash += income - expenses

        # 3. Events land on their recurrence months.
        applied: list[AppliedEvent] = []
        for ev in inp.events:
            if not _event_hits(ev, m):
                continue
            grown = _grown(ev.amount, ev.growth_pct, m - ev.start_month)
            signed = grown if ev.kind == "inflow" else -grown
            if ev.target == "investment":
                inv_exp += signed
                inv_low += signed
                inv_high += signed
            else:
                cash += signed
            applied.append(AppliedEvent(name=ev.name, amount=round(signed, 2), target=ev.target))

        # 4. Optional surplus sweep into investments (uses the expected line for the cash decision).
        if a.auto_invest_surplus and cash > a.emergency_floor:
            surplus = cash - a.emergency_floor
            cash = a.emergency_floor
            inv_exp += surplus
            inv_low += surplus
            inv_high += surplus

        total_income += income
        total_expenses += expenses

        if cash < min_cash:
            min_cash = cash
            min_cash_month = m
            min_cash_date = month_date.isoformat()

        points.append(
            MonthPoint(
                month=m,
                date=month_date.isoformat(),
                income=round(income, 2),
                expenses=round(expenses, 2),
                cash=round(cash, 2),
                investments=round(inv_exp, 2),
                net_worth=round(cash + inv_exp, 2),
                net_worth_low=round(cash + inv_low, 2),
                net_worth_high=round(cash + inv_high, 2),
                events=applied,
            )
        )

    final_nw = points[-1].net_worth if points else round(cash + inv_exp, 2)
    return ProjectionResult(
        points=points,
        final_net_worth=final_nw,
        min_cash=round(min_cash, 2),
        min_cash_month=min_cash_month,
        min_cash_date=min_cash_date,
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
    )
