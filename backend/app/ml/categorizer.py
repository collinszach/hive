"""
Three-stage transaction categorization pipeline.

Stage 1: Regex rule engine (instant, free) — handles ~70% of transactions.
Stage 2: Ollama llama3.2 (local, free) — handles most of the remainder.
Stage 3: Claude Haiku 4.5 (paid fallback) — catches edge cases.

Returns (category, subcategory, source) tuples.
"""
import json
import logging
import re
from typing import Optional

import httpx

from app.config import settings  # noqa: E402 — imported after stdlib

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stage 1: Regex Rule Engine
# Rules must be checked in order — FIRST MATCH WINS.
# High-specificity patterns go first.
# ---------------------------------------------------------------------------

# (pattern, category, subcategory)
_RULES: list[tuple[re.Pattern, str, str]] = []

_RAW_RULES = [
    # Transfers / P2P — must be first to ensure is_excluded logic flows correctly
    (r"venmo|zelle|cash app|paypal transfer|cashapp", "Transfers", "P2P"),

    # Southwest — MUST come before generic Flights (critical for points tracking)
    (r"southwest airlines?", "Travel", "SW Flights"),

    # Airlines
    (r"delta air|united airlines?|american airlines?|jetblue|spirit airlines?|frontier airlines?|alaska airlines?", "Travel", "Flights"),

    # Hotels / Lodging
    (r"marriott|hilton|hyatt|ihg|wyndham|best western|airbnb|vrbo|hampton inn|holiday inn|sheraton|westin|fairfield", "Travel", "Hotel"),

    # Food delivery
    (r"uber eats|doordash|grubhub|instacart delivery|postmates|seamless|caviar|gopuff", "Food & Drink", "Delivery"),

    # Coffee
    (r"starbucks|dunkin|blue bottle|philz|peet|dutch bros|caribou coffee|tim hortons", "Food & Drink", "Coffee"),

    # Fast food
    (r"mcdonald|burger king|wendy|chick-fil-a|subway|chipotle|taco bell|popeyes|kfc|five guys|shake shack|in-n-out|whataburger|sonic drive|arby|dairy queen|jack in the box|panda express|panera", "Food & Drink", "Fast Food"),

    # Grocery stores
    (r"whole foods|trader joe|kroger|safeway|heb|publix|wegmans|aldi|costco|sam.s club|vons|ralphs|sprouts|meijer|stop.shop|giant food|food lion|winco|market basket", "Groceries", "In-Store"),

    # Online grocery
    (r"amazon fresh|instacart(?! delivery)|walmart grocery|shipt|freshdirect|good eggs", "Groceries", "Online"),

    # Streaming
    (r"netflix|spotify|hulu|disney\+|disney plus|hbo max|apple\.com/bill|apple\.com.*subs|peacock|paramount\+|paramount plus|youtube premium|amazon prime video|showtime|starz|crunchyroll|tidal", "Entertainment", "Streaming"),

    # Pharmacy
    (r"cvs|walgreens|rite aid|duane reade|bartell drug", "Health", "Pharmacy"),

    # EV Charging
    (r"tesla supercharger|blink charging|chargepoint|evgo|electrify america|volta charging", "Transportation", "EV Charging"),

    # Transit
    (r"mta|cta|bart|wmata|metro(?:card)?(?! pcs)|clipper card|transit(?! delivery)|septa|mbta|marta|link light rail|trimet", "Transportation", "Transit"),

    # Parking
    (r"spothero|parkwhiz|parking meter|parkmobile|sp\+ parking|impark|laz parking", "Transportation", "Parking"),

    # Gas stations
    (r"shell|bp|exxon|chevron|mobil|sunoco|speedway|circle k|wawa gas|pilot flying|love.s travel|marathon fuel|casey.s general|kwik trip|raceway fuel", "Transportation", "Gas"),

    # Rideshare (must come AFTER Uber Eats)
    (r"uber(?! eats)|lyft|waymo|via ride", "Travel", "Rideshare"),

    # Tolls
    (r"e-zpass|fastrak|sunpass|peach pass|pikepass|txtag|expresstoll", "Transportation", "Tolls"),

    # Amazon (broad, comes after Amazon Fresh)
    (r"amazon\.com|amazon mktp|amzn mktp", "Shopping", "Amazon"),

    # Gym
    (r"planet fitness|equinox|la fitness|orange theory|peloton|24 hour fitness|anytime fitness|ymca|crossfit|f45|barry.s bootcamp", "Health", "Gym"),

    # Pharmacy / Medical (broader)
    (r"urgent care|patient first|kaiser|labcorp|quest diagnostics|aetna|cigna payment|anthem", "Health", "Medical"),

    # Dental
    (r"dental|orthodont|aspen dental|smile direct|smile generation", "Health", "Dental"),

    # Vision
    (r"lenscrafters|visionworks|warby parker|americas best.*vision|clearly contacts|eyeglass world|pearle vision", "Health", "Vision"),

    # Car Rental — completely absent from Stage 1
    (r"hertz|enterprise rent|avis budget|budget car|national car|alamo rent|sixt rent|thrifty car|dollar rent", "Travel", "Car Rental"),

    # Auto Service — in taxonomy but no rule
    (r"jiffy lube|oil change|midas auto|maaco|pep boys|autozone|o.reilly auto|napa auto|advance auto|firestone|discount tire|goodyear tire|valvoline|grease monkey", "Transportation", "Auto Service"),

    # Streaming gaming / subscriptions
    (r"xbox game pass|playstation plus|nintendo eshop|steam purchase|epic games", "Entertainment", "Gaming"),

    # Movies / Events
    (r"fandango|amc theatre|regal cinema|cinemark|ticketmaster|stubhub|eventbrite|live nation", "Entertainment", "Events"),

    # Phone utilities
    (r"verizon|at&t|t-mobile|cricket wireless|google fi|mint mobile|boost mobile", "Utilities", "Phone"),

    # Internet
    (r"comcast|xfinity|spectrum|cox communications|at&t internet|centurylink|frontier communications", "Utilities", "Internet"),

    # Electric / Water / Insurance
    (r"pge|pacific gas|consolidated edison|con ed|duke energy|dominion energy|national grid|citizens energy|american water", "Utilities", "Electric"),
    (r"state farm|geico|progressive|allstate|liberty mutual|usaa insurance|nationwide insurance", "Utilities", "Insurance"),

    # Rent / Mortgage
    (r"rent(?:al)? payment|apartment rent|zego rent|rentcafe|cozy\.co|buildium|yardi|appfolio", "Home", "Rent"),
    (r"mortgage payment|mr. cooper|rocket mortgage|pennymac|loancare|wells fargo home", "Home", "Mortgage"),

    # Home improvement
    (r"home depot|lowe.s|ace hardware|menards|true value|harbor freight", "Home", "Repairs"),

    # Education
    (r"tuition|university|college payment|coursera|udemy|chegg|khan academy|duolingo", "Education", "Courses"),

    # Personal care
    (r"great clips|supercuts|sport clips|aveda salon|ulta beauty|sephora", "Personal Care", "Haircut"),

    # General retail
    (r"target|walmart(?! grocery)|best buy|apple store|apple\.com(?!.*bill)|microsoft store|b&h photo|newegg|adorama", "Shopping", "Electronics"),
    (r"nordstrom|macy.s|bloomingdale.s|gap|old navy|h&m|zara|uniqlo|banana republic|j\.crew|express fashion", "Shopping", "Clothing"),
    (r"wayfair|ikea|crate and barrel|pottery barn|west elm|restoration hardware|overstock", "Home", "Furniture"),

    # Restaurants (broad catch-all — after fast food, delivery, coffee)
    (r"restaurant|bistro|grill|kitchen|cafe|eatery|dining|sushi|ramen|thai|indian|italian|mexican|mediterranean|tavern|\bpub\b|brewery|pizza|taqueria|barbeque|bbq|steakhouse|diner", "Food & Drink", "Restaurant"),

    # Bars
    (r"\bbar\b|nightclub|\blounge\b|cocktail|wine bar|taproom|speakeasy", "Food & Drink", "Bar"),

    # General bank / wire transfers
    (r"online transfer|ach transfer|wire transfer|bank transfer|transfer to |transfer from |deposit transfer|external transfer|internal transfer|zelle payment", "Transfers", "Payment"),

    # Income / Payroll — credits that represent salary, wages, or other income
    # These patterns only fire on negative amounts (credits) in practice since
    # positive transactions rarely contain these keywords.
    (r"direct dep(?:osit)?|payroll|adp totalsource|adp workforce|paychex|ceridian|workday payroll|gusto.*payroll|intuit payroll|ach credit.*(?:payroll|salary|income)|ppd.*payroll|stripe.*payout|square.*payout|shopify.*payout|braintree.*payout|rippling.*payroll|bamboohr.*payroll", "Income", "Salary"),
    (r"check deposit|mobile deposit|remote deposit", "Income", "Other"),
    (r"deloitte|accenture|mckinsey|bain.*consult|bcg.*consult|pwc|kpmg|ernst.*young|ey llp", "Income", "Salary"),
    (r"interest payment|dividend payment|interest earned|savings interest|apy|high.?yield|hysa|savings.*interest|cd.*interest|bond.*interest", "Income", "Interest"),
    (r"tax refund|irs treas|state tax refund|treasury.*tax", "Income", "Tax Refund"),
    (r"freelance|contractor payment|consulting payment|invoice payment|upwork|fiverr|toptal|99designs|guru\.com|freelancer\.com|contra\.com", "Income", "Freelance"),
    (r"reimbursement|expense reimburs|concur|netsuite.*expense|expensify|ramp.*reimb|brex.*reimb", "Income", "Reimbursement"),
    (r"\bbonus\b|signing bonus|annual bonus|performance bonus|spot bonus|retention bonus", "Income", "Bonus"),
    (r"rental income|rent payment received|airbnb.*payout|vrbo.*payout|furnished finder|cozy.*rent|zelle.*rent", "Income", "Rental"),
    (r"bilt.*protect.*credit|rent.*rebate|rent.*credit", "Transfers", "Refund"),
]

for pattern_str, cat, sub in _RAW_RULES:
    _RULES.append((re.compile(pattern_str, re.IGNORECASE), cat, sub))


def _categorize_with_rules(description: str) -> Optional[tuple[str, str]]:
    """Stage 1: regex rule engine. Returns (category, subcategory) or None."""
    for pattern, category, subcategory in _RULES:
        if pattern.search(description):
            return category, subcategory
    return None


# ---------------------------------------------------------------------------
# Stage 1.5: Plaid category mapper
# Maps Plaid's old-style category list to our taxonomy.
# Fire this AFTER regex rules fail, BEFORE Ollama, to avoid LLM cost.
# ---------------------------------------------------------------------------

# Plaid sends a list like ["Food and Drink", "Coffee Shop"].
# We match on the most specific (last) element first, then the primary.
_PLAID_MAP: list[tuple[str, str, str]] = [
    # ── Food & Drink ──────────────────────────────────────────────────────────
    ("coffee shop",                    "Food & Drink", "Coffee"),
    ("fast food",                      "Food & Drink", "Fast Food"),
    ("restaurant",                     "Food & Drink", "Restaurant"),
    ("food delivery",                  "Food & Drink", "Delivery"),
    ("food and drink",                 "Food & Drink", "Restaurant"),  # generic primary
    ("bars",                           "Food & Drink", "Bar"),
    ("nightlife",                      "Food & Drink", "Bar"),
    # ── Groceries ─────────────────────────────────────────────────────────────
    ("supermarkets and groceries",     "Groceries",    "In-Store"),
    ("online grocery",                 "Groceries",    "Online"),
    # ── Travel ────────────────────────────────────────────────────────────────
    ("airlines and aviation",          "Travel",       "Flights"),
    ("air travel",                     "Travel",       "Flights"),
    ("hotels and motels",              "Travel",       "Hotel"),
    ("lodging",                        "Travel",       "Hotel"),
    ("rideshare",                      "Travel",       "Rideshare"),
    ("taxi",                           "Travel",       "Rideshare"),
    ("car and truck rentals",          "Travel",       "Car Rental"),
    ("car rental",                     "Travel",       "Car Rental"),
    ("cruises",                        "Travel",       "Cruise"),
    # ── Transportation ────────────────────────────────────────────────────────
    ("gas stations",                   "Transportation", "Gas"),
    ("fuel",                           "Transportation", "Gas"),
    ("electric vehicle charging",      "Transportation", "EV Charging"),
    ("parking",                        "Transportation", "Parking"),
    ("toll",                           "Transportation", "Tolls"),
    ("transit",                        "Transportation", "Transit"),
    ("public transportation services", "Transportation", "Transit"),
    ("auto maintenance",               "Transportation", "Auto Service"),
    ("automotive",                     "Transportation", "Auto Service"),
    # ── Entertainment ─────────────────────────────────────────────────────────
    ("cable",                          "Entertainment", "Streaming"),
    ("streaming",                      "Entertainment", "Streaming"),
    ("music",                          "Entertainment", "Streaming"),
    ("video games",                    "Entertainment", "Gaming"),
    ("games",                          "Entertainment", "Gaming"),
    ("movie and dvd",                  "Entertainment", "Movies"),
    ("movies",                         "Entertainment", "Movies"),
    ("entertainment",                  "Entertainment", "Events"),  # generic primary
    ("sporting goods",                 "Entertainment", "Sports"),
    # ── Shopping ──────────────────────────────────────────────────────────────
    ("electronics",                    "Shopping",     "Electronics"),
    ("clothing",                       "Shopping",     "Clothing"),
    ("apparel",                        "Shopping",     "Clothing"),
    ("home furnishings",               "Home",         "Furniture"),
    ("shops",                          "Shopping",     "General"),  # generic primary
    # ── Health ────────────────────────────────────────────────────────────────
    ("pharmacies and drug stores",     "Health",       "Pharmacy"),
    ("drug stores",                    "Health",       "Pharmacy"),
    ("doctors and clinics",            "Health",       "Medical"),
    ("hospitals",                      "Health",       "Medical"),
    ("dentist",                        "Health",       "Dental"),
    ("vision",                         "Health",       "Vision"),
    ("gyms and fitness centers",       "Health",       "Gym"),
    ("gym",                            "Health",       "Gym"),
    ("healthcare",                     "Health",       "Medical"),  # generic primary
    # ── Utilities ─────────────────────────────────────────────────────────────
    ("phone",                          "Utilities",    "Phone"),
    ("mobile phones",                  "Utilities",    "Phone"),
    ("internet services",              "Utilities",    "Internet"),
    ("internet",                       "Utilities",    "Internet"),
    ("electricity",                    "Utilities",    "Electric"),
    ("water",                          "Utilities",    "Water"),
    ("insurance",                      "Utilities",    "Insurance"),
    ("utilities",                      "Utilities",    "Electric"),  # generic primary
    # ── Home ──────────────────────────────────────────────────────────────────
    ("rent",                           "Home",         "Rent"),
    ("mortgage",                       "Home",         "Mortgage"),
    ("home improvement",               "Home",         "Repairs"),
    # ── Education ─────────────────────────────────────────────────────────────
    ("colleges and universities",      "Education",    "Tuition"),
    ("education",                      "Education",    "Courses"),
    # ── Personal Care ─────────────────────────────────────────────────────────
    ("hair",                           "Personal Care", "Haircut"),
    ("spas",                           "Personal Care", "Spa"),
    ("personal care",                  "Personal Care", "Haircut"),  # generic primary
    # ── Transfers ─────────────────────────────────────────────────────────────
    ("payment",                        "Transfers",    "Payment"),
    ("transfer",                       "Transfers",    "Payment"),
    ("loan payment",                   "Transfers",    "Payment"),
    ("bank fees",                      "Transfers",    "Payment"),
    # ── Income ────────────────────────────────────────────────────────────────
    ("payroll",                        "Income",       "Salary"),
    ("direct dep",                     "Income",       "Salary"),
    ("direct deposit",                 "Income",       "Salary"),
    ("income",                         "Income",       "Salary"),
    ("interest",                       "Income",       "Interest"),
    ("dividends",                      "Income",       "Interest"),
    ("tax refund",                     "Income",       "Tax Refund"),
]

# Pre-lowercase the match keys for case-insensitive lookup
_PLAID_MAP_LOWER = [(k.lower(), cat, sub) for k, cat, sub in _PLAID_MAP]


def _categorize_with_plaid(plaid_category: Optional[list[str]]) -> Optional[tuple[str, str]]:
    """Stage 1.5: map Plaid's category list to our taxonomy.

    Plaid sends a list from most-generic to most-specific, e.g.
    ["Food and Drink", "Restaurants", "Coffee Shop"].
    We iterate from most-specific (last) to most-generic (first) for best precision.
    """
    if not plaid_category:
        return None
    for raw in reversed(plaid_category):
        key = raw.lower()
        for match_key, cat, sub in _PLAID_MAP_LOWER:
            if match_key in key or key in match_key:
                return cat, sub
    return None


# ---------------------------------------------------------------------------
# Stage 2: Ollama (local llama3.2)
# ---------------------------------------------------------------------------

def _ollama_url() -> str:
    return f"{settings.ollama_url}/api/generate"

_CATEGORIES = """
Food & Drink → Restaurant, Fast Food, Coffee, Delivery, Bar
Groceries → In-Store, Online
Travel → Flights, SW Flights, Hotel, Car Rental, Rideshare, Cruise
Transportation → Gas, EV Charging, Parking, Tolls, Transit, Auto Service
Entertainment → Streaming, Movies, Events, Gaming, Sports
Shopping → General, Clothing, Electronics, Amazon, Home Goods
Health → Medical, Pharmacy, Gym, Dental, Vision
Utilities → Electric, Internet, Phone, Water, Insurance
Home → Rent, Mortgage, Furniture, Repairs, Garden
Education → Tuition, Books, Courses
Personal Care → Haircut, Spa, Clothing
Transfers → P2P, Payment, Refund
Business → Office, Software, Advertising
Income → Salary, Freelance, Interest, Dividend, Tax Refund, Bonus
Uncategorized → (fallback only)
""".strip()

_OLLAMA_PROMPT_TEMPLATE = """You are a financial transaction categorizer for a personal finance app. Assign EXACTLY one category and subcategory from the list below.

RULES:
- Only output valid category/subcategory pairs from this list. Never invent new ones.
- If uncertain, use "Uncategorized" rather than guessing wrong.
- Ignore payment processor prefixes like "SQ *", "TST*", "SP *", "PP.", "AMZN MKTP".
- "TRANSFER", "PAYMENT", "ACH" in the description → Transfers / Payment.

CATEGORIES (Category → allowed Subcategories):
{categories}

EXAMPLES:
Transaction: "SQ *BLUE BOTTLE COFFEE" → {{"category": "Food & Drink", "subcategory": "Coffee"}}
Transaction: "DOORDASH*CHIPOTLE" → {{"category": "Food & Drink", "subcategory": "Delivery"}}
Transaction: "WHOLEFDS #00512" → {{"category": "Groceries", "subcategory": "In-Store"}}
Transaction: "NETFLIX.COM" → {{"category": "Entertainment", "subcategory": "Streaming"}}
Transaction: "HERTZ #00123 SAN FRANCISCO" → {{"category": "Travel", "subcategory": "Car Rental"}}
Transaction: "JIFFY LUBE #1234" → {{"category": "Transportation", "subcategory": "Auto Service"}}
Transaction: "DELOITTE PAYROLL" → {{"category": "Income", "subcategory": "Salary"}}
Transaction: "ADP TOTALSOURCE PAYROLL" → {{"category": "Income", "subcategory": "Salary"}}
Transaction: "IRS TREAS TAX REFUND" → {{"category": "Income", "subcategory": "Tax Refund"}}
Transaction: "UNKNOWN MERCHANT XYZ" → {{"category": "Uncategorized", "subcategory": "Uncategorized"}}

Now categorize:
Transaction: "{description}"

Reply with ONLY a JSON object like: {{"category": "Food & Drink", "subcategory": "Restaurant"}}
No explanation. No markdown. Just the JSON object."""

_CLAUDE_SYSTEM_PROMPT = (
    "You are a financial transaction categorizer. "
    "Reply with ONLY a JSON object {\"category\": \"...\", \"subcategory\": \"...\"}. "
    "Use only the taxonomy provided. If uncertain, return Uncategorized/Uncategorized."
)


def _ollama_request(prompt: str) -> Optional[tuple[str, str]]:
    """Make a single Ollama /api/generate request. Returns (category, subcategory) or None.
    Raises httpx.TimeoutException or httpx.ConnectError on transient failures."""
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            _ollama_url(),
            json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
        )
        response.raise_for_status()
        raw = response.json().get("response", "").strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        category = data.get("category", "").strip()
        subcategory = data.get("subcategory", "").strip()
        if category and subcategory:
            return category, subcategory
    return None


def _categorize_with_ollama(description: str) -> Optional[tuple[str, str]]:
    """Stage 2: Ollama llama3.2. Returns (category, subcategory) or None.
    Retries once on timeout or connection error before giving up."""
    import time

    prompt = _OLLAMA_PROMPT_TEMPLATE.format(
        categories=_CATEGORIES,
        description=description,
    )
    for attempt in range(2):
        try:
            return _ollama_request(prompt)
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            if attempt == 0:
                logger.warning("Ollama transient error (attempt 1), retrying in 2s: %s", exc)
                time.sleep(2)
            else:
                logger.warning("Ollama categorization failed after retry: %s", exc)
        except Exception as exc:
            logger.warning("Ollama categorization failed: %s", exc)
            break
    return None


# ---------------------------------------------------------------------------
# Stage 3: Claude Haiku 4.5
# ---------------------------------------------------------------------------

def _categorize_with_claude(description: str) -> Optional[tuple[str, str]]:
    """Stage 3: Claude Haiku 4.5 API fallback. Returns (category, subcategory) or None."""
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        user_content = (
            f"Categories:\n{_CATEGORIES}\n\n"
            f"Transaction: \"{description}\"\n\n"
            "Reply with ONLY a JSON object."
        )
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=64,
            system=_CLAUDE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        category = data.get("category", "").strip()
        subcategory = data.get("subcategory", "").strip()
        if category and subcategory:
            return category, subcategory
    except Exception as exc:
        logger.error("Claude Haiku categorization failed: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def categorize_transaction(
    description: str,
    plaid_category: Optional[list[str]] = None,
) -> tuple[str, str, str]:
    """
    Categorize a transaction using the 4-stage pipeline.

    Stages:
      1. Regex rules (fast, free, ~70% coverage)
      1.5. Plaid category hint (free, good for edge cases)
      2. Ollama llama3.2 (local, free)
      3. Claude Haiku 4.5 (paid fallback)

    Returns (category, subcategory, source) where source is one of:
      "rules", "plaid", "ollama", "claude", "uncategorized"
    """
    # Stage 1: regex rules
    result = _categorize_with_rules(description)
    if result:
        return result[0], result[1], "rules"

    # Stage 1.5: Plaid category hint — free, often accurate
    result = _categorize_with_plaid(plaid_category)
    if result and result[0] != "Uncategorized":
        return result[0], result[1], "plaid"

    # Stage 2: Ollama
    result = _categorize_with_ollama(description)
    if result:
        return result[0], result[1], "ollama"

    # Stage 3: Claude Haiku
    result = _categorize_with_claude(description)
    if result:
        return result[0], result[1], "claude"

    logger.warning("Could not categorize transaction: %s", description)
    return "Uncategorized", "Uncategorized", "uncategorized"
