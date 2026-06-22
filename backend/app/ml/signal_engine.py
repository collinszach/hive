"""Signal engine — technical indicators + ML regime classification.

**Point-in-time safety is the core contract.** Every public function takes an explicit
``as_of`` cutoff and reads only candles with ``date <= as_of``. The backtester (Phase 3)
and the live engine (Phase 4) call these *identical* functions, so backtest behavior
matches live behavior exactly. The anti-lookahead guarantee is verifiable: feeding a
function the full candle series vs. a series truncated at ``as_of`` must yield identical
output (see ``tests/test_backtest_no_lookahead.py``).

This is pattern/regime *classification* (which market state are we in?), not price
prediction — same spirit as the existing ``IsolationForest`` anomaly detector. Nothing
here forecasts a future price or return.

Indicators are computed off **adjusted close** so splits/dividends don't read as moves.
"""
import logging
from datetime import date
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Indicator windows
_SMA_FAST, _SMA_SLOW = 20, 50
_EMA_FAST, _EMA_SLOW, _MACD_SIGNAL = 12, 26, 9
_RSI_PERIOD = 14
_VOL_WINDOW = 20
_MOMENTUM_WINDOW = 20

# Regime clustering
_N_REGIMES = 3
_MIN_REGIME_ROWS = 30  # need enough feature rows to cluster meaningfully
_REGIME_FEATURES = ["volatility", "momentum", "rsi_14"]

# Signal scoring thresholds (defaults; backtest may tune these)
_DEFAULT_RSI_OVERSOLD = 30.0
_DEFAULT_RSI_OVERBOUGHT = 70.0
_BUY_THRESHOLD = 0.25
_SELL_THRESHOLD = -0.25


def _price_series(df: pd.DataFrame) -> pd.Series:
    """Adjusted close, falling back to raw close where adj is missing."""
    if "adj_close" in df.columns:
        return df["adj_close"].astype(float).fillna(df["close"].astype(float))
    return df["close"].astype(float)


def compute_technical_indicators(candles_df: pd.DataFrame, as_of: date) -> pd.DataFrame:
    """Return a DataFrame of indicators for all bars with ``date <= as_of``.

    Anti-lookahead: filters to ``date <= as_of`` first, then every indicator is a
    causal (backward-looking) transform — rolling means, recursive EMAs, diffs — so
    no future bar can influence any row. Columns: date, price, sma_20, sma_50,
    ema_12, ema_26, macd, macd_signal, macd_hist, rsi_14, volatility, momentum.
    """
    df = candles_df[candles_df["date"] <= as_of].sort_values("date").reset_index(drop=True)
    out = pd.DataFrame({"date": df["date"]}) if not df.empty else pd.DataFrame(columns=["date"])
    if df.empty:
        return out

    price = _price_series(df).reset_index(drop=True)
    out["price"] = price
    out["sma_20"] = price.rolling(_SMA_FAST).mean()
    out["sma_50"] = price.rolling(_SMA_SLOW).mean()
    out["ema_12"] = price.ewm(span=_EMA_FAST, adjust=False).mean()
    out["ema_26"] = price.ewm(span=_EMA_SLOW, adjust=False).mean()
    out["macd"] = out["ema_12"] - out["ema_26"]
    out["macd_signal"] = out["macd"].ewm(span=_MACD_SIGNAL, adjust=False).mean()
    out["macd_hist"] = out["macd"] - out["macd_signal"]

    # Wilder's RSI (recursive EMA of gains/losses) — bounded [0, 100].
    delta = price.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / _RSI_PERIOD, adjust=False, min_periods=_RSI_PERIOD).mean()
    avg_loss = loss.ewm(alpha=1.0 / _RSI_PERIOD, adjust=False, min_periods=_RSI_PERIOD).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    # When avg_loss == 0 (pure uptrend), RSI saturates at 100.
    rsi = rsi.where(avg_loss != 0.0, 100.0)
    out["rsi_14"] = rsi

    returns = price.pct_change()
    out["volatility"] = returns.rolling(_VOL_WINDOW).std()
    out["momentum"] = price / price.shift(_MOMENTUM_WINDOW) - 1.0
    return out


def detect_regime(history_df: pd.DataFrame, as_of: date) -> str:
    """Classify the market regime at ``as_of`` via KMeans over [volatility, momentum, RSI].

    Anti-lookahead: the scaler and KMeans are **fit only on feature rows with
    ``date <= as_of``** (expanding window) — never fit once on the full series and
    applied backward, which would leak the future distribution's shape into past
    decisions. Cluster ids are mapped to stable semantic labels by ranking cluster
    centers on momentum, so the label is meaningful and deterministic.

    Returns one of: "bullish", "neutral", "bearish", or "unknown" (too little data).
    """
    df = history_df[history_df["date"] <= as_of]
    feats = df[_REGIME_FEATURES].replace([np.inf, -np.inf], np.nan).dropna().reset_index(drop=True)
    if len(feats) < _MIN_REGIME_ROWS:
        return "unknown"

    X = StandardScaler().fit_transform(feats.values)
    km = KMeans(n_clusters=_N_REGIMES, random_state=42, n_init=10)
    labels = km.fit_predict(X)

    # Map clusters → semantic labels by mean momentum (lowest = bearish).
    momentum = feats["momentum"].values
    cluster_momentum = [
        momentum[labels == c].mean() if np.any(labels == c) else 0.0
        for c in range(_N_REGIMES)
    ]
    order = np.argsort(cluster_momentum)  # ascending momentum
    semantic = {order[0]: "bearish", order[1]: "neutral", order[2]: "bullish"}

    as_of_cluster = int(labels[-1])  # last feature row corresponds to as_of
    return semantic[as_of_cluster]


def score_signal(
    indicators_row: pd.Series,
    regime_label: str,
    *,
    rsi_oversold: float = _DEFAULT_RSI_OVERSOLD,
    rsi_overbought: float = _DEFAULT_RSI_OVERBOUGHT,
) -> dict:
    """Combine indicator crossovers + regime into a signal.

    Returns ``{"signal_score": -1..1, "signal_label": buy|sell|hold, "confidence": 0..1}``.
    A row with missing core indicators degrades to a flat hold (score 0, confidence 0).
    """
    def val(key: str) -> Optional[float]:
        v = indicators_row.get(key) if hasattr(indicators_row, "get") else indicators_row[key]
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return float(v)

    macd, macd_sig = val("macd"), val("macd_signal")
    sma_f, sma_s = val("sma_20"), val("sma_50")
    rsi = val("rsi_14")
    if macd is None or macd_sig is None or sma_f is None or sma_s is None or rsi is None:
        return {"signal_score": 0.0, "signal_label": "hold", "confidence": 0.0}

    score = 0.0
    # MACD crossover (trend momentum)
    score += 0.3 if macd > macd_sig else -0.3
    # SMA trend
    score += 0.2 if sma_f > sma_s else -0.2
    # RSI mean-reversion: oversold → lean buy, overbought → lean sell
    if rsi <= rsi_oversold:
        score += 0.3
    elif rsi >= rsi_overbought:
        score -= 0.3
    # Regime tilt
    if regime_label == "bullish":
        score += 0.2
    elif regime_label == "bearish":
        score -= 0.2

    score = float(max(-1.0, min(1.0, score)))
    if score >= _BUY_THRESHOLD:
        label = "buy"
    elif score <= _SELL_THRESHOLD:
        label = "sell"
    else:
        label = "hold"
    return {"signal_score": score, "signal_label": label, "confidence": abs(score)}


def _load_candles_df(db, symbol: str) -> pd.DataFrame:
    """Load all cached candles for a symbol into a DataFrame (ascending by date)."""
    from sqlalchemy import select

    from app.models.paper_candle import PaperCandle

    rows = db.execute(
        select(
            PaperCandle.date,
            PaperCandle.open,
            PaperCandle.high,
            PaperCandle.low,
            PaperCandle.close,
            PaperCandle.volume,
            PaperCandle.adj_close,
        ).where(PaperCandle.symbol == symbol).order_by(PaperCandle.date)
    ).all()
    if not rows:
        return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume", "adj_close"])
    df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume", "adj_close"])
    for col in ("open", "high", "low", "close", "volume", "adj_close"):
        df[col] = df[col].astype(float)
    return df


def generate_signal_for_symbol(
    candles_df: pd.DataFrame, as_of: date, **score_kwargs
) -> Optional[dict]:
    """Compute a single point-in-time signal dict for one symbol at ``as_of``.

    Returns ``None`` if there isn't enough history to produce an indicators row at
    ``as_of``. The returned dict carries the score, label, confidence, regime, and the
    raw indicator values (for the ``indicators`` JSONB / transparency).
    """
    indicators = compute_technical_indicators(candles_df, as_of)
    if indicators.empty:
        return None
    # The as_of row is the last row at-or-before as_of.
    on_or_before = indicators[indicators["date"] <= as_of]
    if on_or_before.empty:
        return None
    row = on_or_before.iloc[-1]
    if row["date"] != as_of:
        # No bar exactly on as_of (weekend/holiday) — use the latest prior bar's date
        # but still only past data was used. Signal is stamped at as_of by the caller.
        pass

    regime = detect_regime(indicators, as_of)
    scored = score_signal(row, regime, **score_kwargs)

    def num(v):
        return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), 6)

    return {
        "signal_score": round(scored["signal_score"], 4),
        "signal_label": scored["signal_label"],
        "confidence": round(scored["confidence"], 4),
        "regime_label": regime,
        "indicators": {
            "price": num(row.get("price")),
            "sma_20": num(row.get("sma_20")),
            "sma_50": num(row.get("sma_50")),
            "ema_12": num(row.get("ema_12")),
            "ema_26": num(row.get("ema_26")),
            "macd": num(row.get("macd")),
            "macd_signal": num(row.get("macd_signal")),
            "macd_hist": num(row.get("macd_hist")),
            "rsi_14": num(row.get("rsi_14")),
            "volatility": num(row.get("volatility")),
            "momentum": num(row.get("momentum")),
            "bar_date": row["date"].isoformat(),
        },
    }


def run_signal_generation(
    db, as_of: date, *, source: str = "live", symbols: Optional[list[str]] = None, **score_kwargs
) -> dict:
    """Orchestrate signal generation across symbols for a single ``as_of`` date.

    Loads each symbol's candle history, computes a point-in-time signal, and upserts
    into ``paper_signals`` keyed on (symbol, as_of, source). Returns a summary dict.
    """
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.models.paper_signal import PaperSignal
    from app.models.paper_watchlist_symbol import PaperWatchlistSymbol

    if symbols is None:
        rows = db.execute(
            select(PaperWatchlistSymbol.symbol).where(
                PaperWatchlistSymbol.is_active == True  # noqa: E712
            )
        ).scalars().all()
        symbols = sorted({s.strip().upper() for s in rows if s and s.strip()})

    written = 0
    skipped = 0
    for symbol in symbols:
        candles = _load_candles_df(db, symbol)
        signal = generate_signal_for_symbol(candles, as_of, **score_kwargs)
        if signal is None:
            skipped += 1
            continue
        stmt = pg_insert(PaperSignal).values(
            symbol=symbol,
            as_of=as_of,
            source=source,
            signal_score=signal["signal_score"],
            signal_label=signal["signal_label"],
            confidence=signal["confidence"],
            regime_label=signal["regime_label"],
            indicators=signal["indicators"],
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
        "run_signal_generation: as_of=%s source=%s written=%d skipped=%d",
        as_of, source, written, skipped,
    )
    return {"as_of": as_of.isoformat(), "source": source, "written": written, "skipped": skipped}
