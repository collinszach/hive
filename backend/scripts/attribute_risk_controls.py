"""Attribution: run the momentum backtest with each risk control toggled in isolation.

Answers "which control destroyed the return?" by holding everything constant and adding
one control at a time, over the same window/universe. Runs sequentially (concurrent
backtests would clobber each other's source='backtest' signals). ~15 min per config.

    PYTHONPATH=/app python scripts/attribute_risk_controls.py
"""
from datetime import date

from sqlalchemy import select

from app.db import get_sync_db
from app.models.paper_portfolio import PaperPortfolio
from app.models.paper_watchlist_symbol import PaperWatchlistSymbol
from app.paper_trading.backtest import run_walk_forward_backtest

START, END, CASH = date(2025, 6, 1), date(2026, 6, 19), 10_000.0

# Base = all new controls OFF (loose per-name cap to match the +70% baseline).
OFF = {"max_position_pct": 0.35, "sector_cap_pct": 1.0,
       "stop_loss_pct": 0.0, "dd_halve_pct": 1.0, "dd_flatten_pct": 1.0}

CONFIGS = {
    "baseline (all off)": {},
    "sector cap only": {"sector_cap_pct": 0.30},
    "stop-loss only": {"stop_loss_pct": 0.20},
    "drawdown brake only": {"dd_halve_pct": 0.15, "dd_flatten_pct": 0.20},
    "per-name cap only": {"max_position_pct": 0.20},
}


def main():
    db = get_sync_db()
    syms = sorted(db.execute(select(PaperWatchlistSymbol.symbol)).scalars())
    print(f"ATTR universe={len(syms)} window={START}..{END}\n")
    print(f'{"config":<22}{"final$":>9}{"return":>9}{"sharpe":>8}{"vsSPY":>8}')
    spy = None
    for name, override in CONFIGS.items():
        params = {**OFF, **override}
        r = run_walk_forward_backtest(db, syms, START, END, strategy_params=params,
                                      starting_cash=CASH, status="attr_tmp")
        db.commit()
        final = CASH * (1 + r.total_return)
        spy = CASH * (1 + (r.total_return - r.vs_benchmark))
        print(f'{name:<22}{final:>9.0f}{r.total_return:>8.1%}{r.sharpe:>8.2f}{r.vs_benchmark:>+7.1%}')
    print(f'\nSPY buy-and-hold: {spy:.0f}')
    # Clean up the throwaway backtest portfolios.
    db.query(PaperPortfolio).filter(PaperPortfolio.status == "attr_tmp").delete()
    db.commit()
    db.close()


if __name__ == "__main__":
    main()
