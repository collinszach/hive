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
    (r"mta|cta|bart|wmata|metro(?:card)?|clipper card|transit(?! delivery)|septa|mbta|marta|link light rail|trimet", "Transportation", "Transit"),

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

    # Dental / Vision
    (r"dental|orthodont|aspen dental|smile direct|americas best|lenscrafters|visionworks", "Health", "Dental"),

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
    (r"restaurant|bistro|grill|kitchen|cafe|eatery|dining|sushi|ramen|thai|indian|italian|mexican|mediterranean|tavern|pub |brewery|pizza|taqueria|barbeque|bbq|steakhouse|diner", "Food & Drink", "Restaurant"),

    # Bars
    (r"bar |nightclub|lounge |cocktail|wine bar|taproom", "Food & Drink", "Bar"),

    # General bank / wire transfers
    (r"online transfer|ach transfer|wire transfer|bank transfer|transfer to |transfer from |deposit transfer|external transfer|internal transfer|zelle payment", "Transfers", "Payment"),
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
Uncategorized → (fallback only)
""".strip()

_OLLAMA_PROMPT_TEMPLATE = """You are a financial transaction categorizer. Categorize this transaction.

Categories:
{categories}

Transaction: "{description}"

Reply with ONLY a JSON object like: {{"category": "Food & Drink", "subcategory": "Restaurant"}}
No explanation. No markdown. Just JSON."""


def _categorize_with_ollama(description: str) -> Optional[tuple[str, str]]:
    """Stage 2: Ollama llama3.2. Returns (category, subcategory) or None."""
    prompt = _OLLAMA_PROMPT_TEMPLATE.format(
        categories=_CATEGORIES,
        description=description,
    )
    try:
        with httpx.Client(timeout=15.0) as client:
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
    except Exception as exc:
        logger.warning("Ollama categorization failed: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Stage 3: Claude Haiku 4.5
# ---------------------------------------------------------------------------

def _categorize_with_claude(description: str) -> Optional[tuple[str, str]]:
    """Stage 3: Claude Haiku 4.5 API fallback. Returns (category, subcategory) or None."""
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        prompt = _OLLAMA_PROMPT_TEMPLATE.format(
            categories=_CATEGORIES,
            description=description,
        )
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=128,
            messages=[{"role": "user", "content": prompt}],
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

def categorize_transaction(description: str) -> tuple[str, str, str]:
    """
    Categorize a transaction using the 3-stage pipeline.

    Returns (category, subcategory, source) where source is one of:
      "rules", "ollama", "claude", "uncategorized"
    """
    # Stage 1
    result = _categorize_with_rules(description)
    if result:
        return result[0], result[1], "rules"

    # Stage 2
    result = _categorize_with_ollama(description)
    if result:
        return result[0], result[1], "ollama"

    # Stage 3
    result = _categorize_with_claude(description)
    if result:
        return result[0], result[1], "claude"

    logger.warning("Could not categorize transaction: %s", description)
    return "Uncategorized", "Uncategorized", "uncategorized"
