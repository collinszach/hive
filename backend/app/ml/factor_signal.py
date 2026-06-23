"""Factor signal engine — cross-sectional 12-1 momentum.

Replaces the technical-indicator + KMeans engine in ``signal_engine.py``, which an
information-coefficient study proved carries **no positive predictive power** on this
universe (rank-IC ≈ 0, slightly negative). Cross-sectional 12-1 momentum — the
single most robust equity factor in the literature — measured a rank-IC of ~+0.04
(t≈6) over 2020-2026 and ~+0.05 (t≈3.6) in the most recent out-of-sample window.

**Point-in-time safety** is preserved: ``compute_momentum`` reads only candles with
``date <= as_of``. Unlike the per-symbol technical engine, momentum is **relative** —
a name's signal depends on how its trailing return ranks against the rest of the
universe *on that date* — so scoring is done cross-sectionally in
``run_factor_signal_generation`` after every symbol's raw momentum is computed.

12-1 momentum = trailing 12-month return skipping the most recent month
(``price[t-21] / price[t-252] - 1``). Skipping the last ~21 trading days avoids the
well-documented short-term reversal effect, and means the signal barely moves day to
day — so it is inherently robust to 1-bar execution timing.
"""
import logging
from datetime import date
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# 12-1 momentum windows (trading days).
_LOOKBACK = 252   # ~12 months
_SKIP = 21        # ~1 month, skipped to dodge short-term reversal
_MIN_ROWS = _LOOKBACK + 1

# Cross-sectional scoring: z-scores beyond this many σ map to full conviction (±1).
_Z_FULL_CONVICTION = 2.0
# Below this cross-sectional dispersion there's no relative information (and dividing by
# near-zero std would amplify floating-point noise into spurious ±1 z-scores).
_MIN_STD = 1e-9
# Label thresholds on the cross-sectional z-score.
_BUY_Z = 0.5
_SELL_Z = -0.5


def _price_series(df: pd.DataFrame) -> pd.Series:
    """Adjusted close, falling back to raw close where adj is missing."""
    if "adj_close" in df.columns:
        return df["adj_close"].astype(float).fillna(df["close"].astype(float))
    return df["close"].astype(float)


def compute_momentum(candles_df: pd.DataFrame, as_of: date) -> Optional[float]:
    """Return point-in-time 12-1 momentum for one symbol at ``as_of``, or ``None``.

    Anti-lookahead: filters to ``date <= as_of`` first, then reads only prices from
    ``t-252`` and ``t-21`` — never a future bar. ``None`` when there isn't ~12 months
    of history yet.
    """
    df = candles_df[candles_df["date"] <= as_of].sort_values("date")
    if len(df) < _MIN_ROWS:
        return None
    price = _price_series(df).reset_index(drop=True)
    p_recent = price.iloc[-1 - _SKIP]    # ~21 trading days before as_of
    p_old = price.iloc[-1 - _LOOKBACK]   # ~252 trading days before as_of
    if p_old <= 0 or np.isnan(p_recent) or np.isnan(p_old):
        return None
    return float(p_recent / p_old - 1.0)


def score_cross_section(raw: dict[str, float]) -> dict[str, dict]:
    """Turn raw per-symbol momentum into cross-sectionally z-scored signals.

    ``raw``: {symbol: momentum}. Returns {symbol: {signal_score, signal_label,
    confidence, regime_label, indicators}}. A name's score is its momentum z-score
    across the universe (clipped to ±1 at ``_Z_FULL_CONVICTION`` σ); the label is
    buy/sell/hold by z-score band. With <2 names or zero dispersion, everything is a
    flat hold (no relative information).
    """
    syms = [s for s, v in raw.items() if v is not None and not np.isnan(v)]
    out: dict[str, dict] = {}
    if len(syms) < 2:
        return {s: _flat(raw.get(s)) for s in raw}

    vals = np.array([raw[s] for s in syms], dtype=float)
    mean, std = vals.mean(), vals.std()
    if std < _MIN_STD:  # no dispersion → nothing to rank
        return {s: _flat(raw.get(s)) for s in raw}
    for s in raw:
        v = raw.get(s)
        if v is None or np.isnan(v):
            out[s] = _flat(v)
            continue
        z = (v - mean) / std
        score = float(max(-1.0, min(1.0, z / _Z_FULL_CONVICTION)))
        if z >= _BUY_Z:
            label = "buy"
        elif z <= _SELL_Z:
            label = "sell"
        else:
            label = "hold"
        out[s] = {
            "signal_score": round(score, 4),
            "signal_label": label,
            "confidence": round(abs(score), 4),
            "regime_label": "momentum",
            "indicators": {"momentum_12_1": round(v, 6), "z_score": round(z, 4)},
        }
    return out


def _flat(momentum: Optional[float]) -> dict:
    ind = {"momentum_12_1": round(momentum, 6) if momentum is not None else None}
    return {
        "signal_score": 0.0,
        "signal_label": "hold",
        "confidence": 0.0,
        "regime_label": "momentum",
        "indicators": ind,
    }


def run_factor_signal_generation(
    db, as_of: date, *, source: str = "live", symbols: Optional[list[str]] = None, **_ignored
) -> dict:
    """Cross-sectional momentum signal generation for a single ``as_of`` date.

    Drop-in replacement for ``signal_engine.run_signal_generation`` (same signature, so
    the backtester and tasks call it identically). Computes every symbol's point-in-time
    momentum, scores the cross-section, and upserts ``paper_signals`` keyed on
    (symbol, as_of, source). Extra keyword args (legacy RSI thresholds, etc.) are ignored.
    """
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.ml.signal_engine import _load_candles_df
    from app.models.paper_signal import PaperSignal
    from app.models.paper_watchlist_symbol import PaperWatchlistSymbol

    if symbols is None:
        rows = db.execute(
            select(PaperWatchlistSymbol.symbol).where(
                PaperWatchlistSymbol.is_active == True  # noqa: E712
            )
        ).scalars().all()
        symbols = sorted({s.strip().upper() for s in rows if s and s.strip()})

    raw: dict[str, float] = {}
    skipped = 0
    for symbol in symbols:
        mom = compute_momentum(_load_candles_df(db, symbol), as_of)
        if mom is None:
            skipped += 1
            continue
        raw[symbol] = mom

    scored = score_cross_section(raw)
    written = 0
    for symbol, sig in scored.items():
        stmt = pg_insert(PaperSignal).values(
            symbol=symbol,
            as_of=as_of,
            source=source,
            signal_score=sig["signal_score"],
            signal_label=sig["signal_label"],
            confidence=sig["confidence"],
            regime_label=sig["regime_label"],
            indicators=sig["indicators"],
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_paper_signal_symbol_asof_source",
            set_={
                "signal_score": stmt.excluded.signal_score,
                "signal_label": stmt.excluded.signal_label,
                "confidence": stmt.excluded.confidence,
                "regime_label": stmt.excluded.regime_label,
                "indicators": stmt.excluded.indicators,
            },
        )
        db.execute(stmt)
        written += 1

    logger.info(
        "run_factor_signal_generation: as_of=%s source=%s written=%d skipped=%d",
        as_of, source, written, skipped,
    )
    return {"as_of": as_of.isoformat(), "source": source, "written": written, "skipped": skipped}
