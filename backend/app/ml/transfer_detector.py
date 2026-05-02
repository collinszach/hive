"""
Transfer detector — stage 0 before categorization.
Identifies transfers and payments that must be excluded from spending analytics.
"""
import re

# P2P payments — no longer excluded; Venmo/Zelle are real transactions
# kept for subcategory classification only
_P2P_PATTERNS = re.compile(
    r"venmo|zelle|cash app|paypal transfer|cashapp",
    re.IGNORECASE,
)

# Bank-level transfers between accounts
_BANK_TRANSFER_PATTERNS = re.compile(
    r"online transfer|ach transfer|wire transfer|bank transfer|"
    r"transfer to |transfer from |deposit transfer|"
    r"external transfer|internal transfer|"
    r"withdrawal to savings|deposit from (?:checking|savings|emergency)|"
    r"autopilot transfer",
    re.IGNORECASE,
)

# Credit card autopayments — money leaving checking to pay a card
# These are transfers; the underlying charges are already tracked on the card
_AUTOPAY_PATTERNS = re.compile(
    r"autopay payment|automatic payment - thank|autopay pymt|"
    r"autopay - thank|auto pay -|"
    r"amex epayment|amex payment|"
    r"chase credit crd|chase autopay|"
    r"capital one autopay|capital one payment|capital one(?! arena)|"
    r"discover e-payment|citi autopay|"
    r"wells fargo payment|wf credit card|"
    r"bilt card|bilt payment|bilt mastercard|"
    r"autopay - mobile|automatic payment|payment thank you|"
    r"credit card payment|balance transfer",
    re.IGNORECASE,
)


def classify_transfer_subcategory(description: str) -> str:
    """
    Determine the subcategory for a transaction already identified as a transfer.
    Returns one of: 'P2P', 'Payment', 'Refund'.
    """
    if _P2P_PATTERNS.search(description):
        return "P2P"
    if _AUTOPAY_PATTERNS.search(description):
        return "Payment"
    return "Payment"


def is_transfer(description: str) -> tuple[bool, bool]:
    """
    Check if a transaction is a transfer that should be excluded from analytics.

    Returns (is_transfer, is_excluded):
    - P2P (Venmo/Zelle/CashApp): (False, False) — real payments, show in spending
    - Bank transfers / savings moves: (True, True)
    - Credit card autopayments: (True, True)
    - Normal transactions: (False, False)
    """
    if _P2P_PATTERNS.search(description):
        return False, False  # Venmo/Zelle are real transactions, not excluded

    if _BANK_TRANSFER_PATTERNS.search(description):
        return True, True

    if _AUTOPAY_PATTERNS.search(description):
        return True, True

    return False, False
