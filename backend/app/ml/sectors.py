"""GICS-style sector map for the paper-trading universe.

Used by the strategy's sector cap (diversification overlay) so a momentum signal can't
pile the whole book into one sector — e.g. the 2025-26 semiconductor melt-up that took
INTC + AMD to ~52% of the book. Symbols not in the map are treated as their own sector
(``sector_of`` returns the symbol), so they're never spuriously grouped or capped.
"""

SECTOR_MAP: dict[str, str] = {
    # Information Technology
    "AAPL": "Information Technology", "MSFT": "Information Technology",
    "NVDA": "Information Technology", "AVGO": "Information Technology",
    "ORCL": "Information Technology", "ADBE": "Information Technology",
    "CRM": "Information Technology", "AMD": "Information Technology",
    "INTC": "Information Technology", "CSCO": "Information Technology",
    "QCOM": "Information Technology", "TXN": "Information Technology",
    # Communication Services
    "GOOGL": "Communication Services", "META": "Communication Services",
    "NFLX": "Communication Services", "DIS": "Communication Services",
    "VZ": "Communication Services", "T": "Communication Services",
    # Consumer Discretionary
    "AMZN": "Consumer Discretionary", "HD": "Consumer Discretionary",
    "MCD": "Consumer Discretionary", "NKE": "Consumer Discretionary",
    "SBUX": "Consumer Discretionary", "TSLA": "Consumer Discretionary",
    # Consumer Staples
    "PG": "Consumer Staples", "KO": "Consumer Staples", "PEP": "Consumer Staples",
    "WMT": "Consumer Staples", "COST": "Consumer Staples",
    # Financials (incl. V/MA/AXP, GICS-reclassified)
    "JPM": "Financials", "BAC": "Financials", "WFC": "Financials", "GS": "Financials",
    "MS": "Financials", "V": "Financials", "MA": "Financials", "AXP": "Financials",
    "C": "Financials", "BLK": "Financials",
    # Health Care
    "UNH": "Health Care", "JNJ": "Health Care", "LLY": "Health Care", "PFE": "Health Care",
    "MRK": "Health Care", "ABBV": "Health Care", "TMO": "Health Care", "ABT": "Health Care",
    # Industrials
    "CAT": "Industrials", "BA": "Industrials", "GE": "Industrials", "HON": "Industrials",
    "UPS": "Industrials", "RTX": "Industrials",
    # Energy
    "XOM": "Energy", "CVX": "Energy",
}


def sector_of(symbol: str) -> str:
    """Return the symbol's sector, or the symbol itself when unmapped (its own bucket)."""
    return SECTOR_MAP.get(symbol.upper(), symbol.upper())
