"""Point-in-time fundamental data from SEC EDGAR (free, no key).

Pulls annual (10-K) financials from EDGAR's XBRL ``companyfacts`` API. The defining
property — and the whole reason for using EDGAR over cheaper "current snapshot" feeds —
is that **every fact carries its filing date** (``filed``), so the signal can read only
what was public at a given ``as_of`` and never look ahead. We keep the *as-originally-
reported* value for each fiscal year by taking the earliest filing that disclosed it
(later 10-Ks restate prior years; those are ignored).

Mirrors the graceful-skip shape of the other connectors: ``get_connector()`` returns a
configured client (EDGAR needs no key, just a contact User-Agent per SEC policy).
"""
import logging
import time
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

# us-gaap concept tags we need: (fallback tags, unit, is_flow). Flow items (income/cash-flow
# statement) are duration facts — we keep only ~annual periods to exclude quarterly/YTD facts.
# Instant items (balance sheet) are point-in-time snapshots with no duration.
_CONCEPTS = {
    "net_income": (["NetIncomeLoss"], "USD", True),
    "revenue": (
        ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
        "USD", True,
    ),
    "gross_profit": (["GrossProfit"], "USD", True),
    "cost_of_revenue": (["CostOfGoodsAndServicesSold", "CostOfRevenue"], "USD", True),
    "stockholders_equity": (
        ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
        "USD", False,
    ),
    "total_assets": (["Assets"], "USD", False),
    "operating_cash_flow": (
        ["NetCashProvidedByUsedInOperatingActivities",
         "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
        "USD", True,
    ),
    "capex": (["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"], "USD", True),
    "shares": (["CommonStockSharesOutstanding", "WeightedAverageNumberOfDilutedSharesOutstanding"], "shares", False),
}

# Annual flow facts span roughly a fiscal year; exclude quarterly/YTD durations.
_ANNUAL_MIN_DAYS, _ANNUAL_MAX_DAYS = 350, 380


class FundamentalsConnector:
    """Thin EDGAR client returning point-in-time annual fundamentals."""

    def __init__(self, user_agent: str, *, timeout: float = 30.0, min_interval: float = 0.15) -> None:
        self._headers = {"User-Agent": user_agent}
        self._timeout = timeout
        self._min_interval = min_interval  # SEC asks ≤10 req/s; stay well under
        self._last = 0.0
        self._cik: Optional[dict[str, str]] = None

    def _get(self, url: str) -> Optional[dict]:
        wait = self._min_interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        try:
            resp = httpx.get(url, headers=self._headers, timeout=self._timeout)
            self._last = time.monotonic()
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as exc:
            logger.warning("EDGAR request failed for %s: %s", url, exc)
            return None

    def ticker_to_cik(self) -> dict[str, str]:
        """Map upper-case ticker → zero-padded 10-digit CIK (cached)."""
        if self._cik is None:
            data = self._get(_TICKERS_URL) or {}
            self._cik = {
                str(v["ticker"]).upper(): str(v["cik_str"]).zfill(10)
                for v in data.values()
                if v.get("ticker") and v.get("cik_str") is not None
            }
        return self._cik

    @staticmethod
    def _annual_by_period(
        facts: dict, tags: list[str], unit: str, is_flow: bool
    ) -> dict[str, tuple[float, str]]:
        """For the first matching tag, return {period_end: (value, earliest_filed)} from 10-K filings.

        Flow items are restricted to ~annual durations (excludes quarterly/YTD facts that
        share the tag); instant items have no duration.
        """
        for tag in tags:
            node = facts.get(tag)
            if not node:
                continue
            pts = node.get("units", {}).get(unit)
            if not pts:
                continue
            out: dict[str, tuple[float, str]] = {}
            for p in pts:
                form = p.get("form", "")
                if not form.startswith("10-K"):
                    continue
                if p.get("fp") not in ("FY", None):
                    continue
                end, filed, val = p.get("end"), p.get("filed"), p.get("val")
                if end is None or filed is None or val is None:
                    continue
                if is_flow:  # require a ~12-month period to drop quarterly/YTD facts
                    start = p.get("start")
                    if start is None:
                        continue
                    try:
                        span = (date.fromisoformat(end) - date.fromisoformat(start)).days
                    except (TypeError, ValueError):
                        continue
                    if not (_ANNUAL_MIN_DAYS <= span <= _ANNUAL_MAX_DAYS):
                        continue
                # Keep the earliest disclosure of each fiscal-year-end (as-reported).
                if end not in out or filed < out[end][1]:
                    out[end] = (float(val), filed)
            if out:
                return out
        return {}

    def get_annual_fundamentals(self, symbol: str) -> list[dict]:
        """Return per-fiscal-year point-in-time fundamentals for ``symbol``.

        Each record: ``{period_end (date), filed_date (date), net_income, revenue,
        gross_profit, stockholders_equity, total_assets, operating_cash_flow, capex,
        shares}``. Values absent for a year are ``None``. Anchored on net income's 10-K
        (its filing date is when the whole annual picture became public).
        """
        cik = self.ticker_to_cik().get(symbol.upper())
        if cik is None:
            return []
        facts_doc = self._get(_FACTS_URL.format(cik=cik))
        if not facts_doc:
            return []
        gaap = facts_doc.get("facts", {}).get("us-gaap", {})
        parsed = {
            field: self._annual_by_period(gaap, tags, unit, is_flow)
            for field, (tags, unit, is_flow) in _CONCEPTS.items()
        }
        records: list[dict] = []
        for end, (ni, filed) in sorted(parsed["net_income"].items()):
            gp = parsed["gross_profit"].get(end, (None, None))[0]
            if gp is None:  # derive gross profit = revenue − cost of revenue
                rev = parsed["revenue"].get(end, (None, None))[0]
                cor = parsed["cost_of_revenue"].get(end, (None, None))[0]
                gp = (rev - cor) if rev is not None and cor is not None else None
            try:
                period_end = date.fromisoformat(end)
                filed_date = date.fromisoformat(filed)
            except (TypeError, ValueError):
                continue
            records.append({
                "period_end": period_end,
                "filed_date": filed_date,
                "net_income": ni,
                "revenue": parsed["revenue"].get(end, (None, None))[0],
                "gross_profit": gp,
                "stockholders_equity": parsed["stockholders_equity"].get(end, (None, None))[0],
                "total_assets": parsed["total_assets"].get(end, (None, None))[0],
                "operating_cash_flow": parsed["operating_cash_flow"].get(end, (None, None))[0],
                "capex": parsed["capex"].get(end, (None, None))[0],
                "shares": parsed["shares"].get(end, (None, None))[0],
            })
        return records


def get_connector() -> Optional[FundamentalsConnector]:
    """Return a configured EDGAR client (no key needed; uses a contact User-Agent)."""
    from app.config import settings

    ua = getattr(settings, "sec_user_agent", "") or "HIVE Finance Platform admin@hive.local"
    return FundamentalsConnector(user_agent=ua)
