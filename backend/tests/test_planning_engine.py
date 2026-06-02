"""Unit tests for the pure projection engine (Epic 8, Phase 1). No DB required."""
from datetime import date

from app.planning.engine import (
    Assumptions,
    IncomeStream,
    PlanEventInput,
    ProjectionInputs,
    add_months,
    project,
)

START = date(2026, 6, 1)


def _base(**kw) -> ProjectionInputs:
    defaults = dict(
        horizon_months=12,
        start_date=START,
        starting_cash=10_000.0,
        starting_investments=0.0,
        base_monthly_expenses=0.0,
        assumptions=Assumptions(
            annual_return_pct=0.0, annual_inflation_pct=0.0, band_spread_pct=0.0
        ),
        income_streams=[],
        events=[],
    )
    defaults.update(kw)
    return ProjectionInputs(**defaults)


def test_add_months_rolls_year():
    assert add_months(date(2026, 6, 1), 1) == date(2026, 7, 1)
    assert add_months(date(2026, 12, 1), 1) == date(2027, 1, 1)
    assert add_months(date(2026, 1, 1), 25) == date(2028, 2, 1)


def test_horizon_and_dates():
    res = project(_base(horizon_months=24))
    assert len(res.points) == 24
    assert res.points[0].date == "2026-07-01"
    assert res.points[-1].date == "2028-06-01"


def test_flat_when_no_flows():
    res = project(_base())
    assert res.final_net_worth == 10_000.0
    assert all(p.net_worth == 10_000.0 for p in res.points)


def test_investment_compounding():
    # 12% annual on 1,000, no flows → ~1,120 after a year (monthly compounding).
    res = project(
        _base(
            starting_cash=0.0,
            starting_investments=1_000.0,
            assumptions=Assumptions(annual_return_pct=12.0, band_spread_pct=0.0),
        )
    )
    assert abs(res.final_net_worth - 1_120.0) < 1.0
    # Monthly-compounded path exceeds simple interest at the midpoint.
    assert res.points[5].investments > 1_050.0


def test_expense_inflation_grows_outflow():
    flat = project(_base(base_monthly_expenses=1_000.0))
    infl = project(
        _base(
            base_monthly_expenses=1_000.0,
            assumptions=Assumptions(annual_inflation_pct=10.0, band_spread_pct=0.0),
        )
    )
    # Inflation makes total expenses larger → less cash left.
    assert infl.final_net_worth < flat.final_net_worth
    assert infl.points[-1].expenses > infl.points[0].expenses


def test_income_net_of_tax():
    res = project(
        _base(
            starting_cash=0.0,
            income_streams=[IncomeStream(monthly_amount=1_000.0, taxable=True)],
            assumptions=Assumptions(effective_tax_rate_pct=25.0, band_spread_pct=0.0),
        )
    )
    # 12 months × 750 net.
    assert abs(res.final_net_worth - 9_000.0) < 0.01
    assert abs(res.total_income - 9_000.0) < 0.01


def test_income_start_and_end_window():
    res = project(
        _base(
            starting_cash=0.0,
            income_streams=[IncomeStream(monthly_amount=1_000.0, start_month=3, end_month=5, taxable=False)],
        )
    )
    # Active only months 3,4,5 → 3,000.
    assert abs(res.final_net_worth - 3_000.0) < 0.01


def test_once_event_outflow_vs_inflow():
    out = project(_base(events=[PlanEventInput(amount=2_000.0, kind="outflow", start_month=6)]))
    inn = project(_base(events=[PlanEventInput(amount=2_000.0, kind="inflow", start_month=6)]))
    assert out.final_net_worth == 8_000.0
    assert inn.final_net_worth == 12_000.0
    # The dip happens exactly at month 6 for the outflow.
    assert out.points[5].cash == 8_000.0
    assert out.points[4].cash == 10_000.0


def test_recurring_event_expansion():
    # Semiannual tuition: hits months 1 and 7 within a 12-month horizon.
    res = project(
        _base(events=[PlanEventInput(amount=15_000.0, kind="outflow", recurrence="semiannual", start_month=1)])
    )
    hits = [p.month for p in res.points if p.events]
    assert hits == [1, 7]
    assert res.final_net_worth == 10_000.0 - 30_000.0


def test_event_growth_compounds_annually():
    res = project(
        _base(
            horizon_months=24,
            events=[PlanEventInput(amount=1_000.0, kind="outflow", recurrence="annual", start_month=1, growth_pct=10.0)],
        )
    )
    applied = [p.events[0].amount for p in res.points if p.events]
    # Month 1: -1000, Month 13 (1 year later): -1100.
    assert applied[0] == -1_000.0
    assert abs(applied[1] - -1_100.0) < 0.01


def test_confidence_bands_order():
    res = project(
        _base(
            starting_cash=0.0,
            starting_investments=10_000.0,
            assumptions=Assumptions(annual_return_pct=6.0, band_spread_pct=3.0),
        )
    )
    last = res.points[-1]
    assert last.net_worth_low < last.net_worth < last.net_worth_high


def test_auto_invest_sweep_moves_surplus():
    res = project(
        _base(
            horizon_months=1,
            starting_cash=10_000.0,
            income_streams=[IncomeStream(monthly_amount=5_000.0, taxable=False)],
            assumptions=Assumptions(
                annual_return_pct=0.0, emergency_floor=2_000.0, auto_invest_surplus=True, band_spread_pct=0.0
            ),
        )
    )
    p = res.points[0]
    assert p.cash == 2_000.0           # swept down to the floor
    assert p.investments == 13_000.0   # 10k start cash surplus (8k) + 5k income moved in
    assert p.net_worth == 15_000.0


def test_grad_school_runway_trough():
    """A 2-year program: tuition out, income drops, then a post-grad salary step-up.

    Verifies the cash-runway trough surfaces (the number the grad-school module reports).
    """
    res = project(
        _base(
            horizon_months=48,
            starting_cash=40_000.0,
            starting_investments=0.0,
            base_monthly_expenses=2_000.0,
            assumptions=Assumptions(annual_return_pct=0.0, annual_inflation_pct=0.0, band_spread_pct=0.0),
            income_streams=[
                # Reduced part-time income during the 24-month program...
                IncomeStream(monthly_amount=1_500.0, start_month=1, end_month=24, taxable=False, name="stipend"),
                # ...then a real salary after graduation.
                IncomeStream(monthly_amount=6_000.0, start_month=25, taxable=False, name="post-grad salary"),
            ],
            events=[
                # $15k tuition each semester (Aug & Jan ≈ every 6 months) for 2 years.
                PlanEventInput(amount=15_000.0, kind="outflow", recurrence="semiannual",
                               start_month=2, end_month=24, name="tuition"),
            ],
        )
    )
    # Cash bottoms out during school, not at the start or end.
    assert 1 < res.min_cash_month <= 24
    assert res.min_cash < 40_000.0
    # Recovers and grows once the salary kicks in and tuition stops.
    assert res.points[-1].cash > res.min_cash
    assert res.final_net_worth > res.min_cash
