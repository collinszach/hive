"""
Transfer detector — stage 0 before categorization.
Identifies Venmo, Zelle, Cash App, and bank transfer transactions
that must ALWAYS be excluded from spending analytics.
"""
import re

# Critical business rule: these patterns ALWAYS produce is_transfer=True, is_excluded=True
_TRANSFER_PATTERNS = re.compile(
    r"venmo|zelle|cash app|paypal transfer|cashapp",
    re.IGNORECASE,
)

_BANK_TRANSFER_PATTERNS = re.compile(
    r"online transfer|ach transfer|wire transfer|bank transfer|"
    r"transfer to |transfer from |deposit transfer|"
    r"external transfer|internal transfer",
    re.IGNORECASE,
)


def is_transfer(description: str) -> tuple[bool, bool]:
    """
    Check if a transaction is a transfer/P2P payment.

    Returns (is_transfer, is_excluded):
    - P2P payments (Venmo/Zelle/CashApp): (True, True) — excluded from ALL analytics
    - Bank transfers: (True, True) — excluded
    - Normal transactions: (False, False)
    """
    if _TRANSFER_PATTERNS.search(description):
        return True, True

    if _BANK_TRANSFER_PATTERNS.search(description):
        return True, True

    return False, False
