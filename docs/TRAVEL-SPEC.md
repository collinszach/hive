# HIVE — Award Travel Planner & Points Truth

> Owner: Zach Collins · Drafted 2026-09-12 · Design spec, nothing built yet.
> Companion to `docs/PRODUCT-SPEC-NEXT.md`. Two connected problems:
> **(A)** the points balance is a guess, and **(B)** there's no way to spend it deliberately.
> Sizing: **S** < 1d · **M** 1–3d · **L** 3–5d · **XL** 1wk+.

---

## 0. The thesis

Every award-travel tool on the market starts from *"where can I go?"* and knows nothing about your
money. HIVE starts from the opposite end: it already knows your balances, your earn rates, your travel
spend, your budget, and your cash position. The defensible product isn't a flight search — those exist
and are better funded. It's the **decision**: *pay cash or burn points, which currency, which card,
and can I actually afford this trip given everything else I'm doing this month?*

Nobody else can answer that, because nobody else has both halves.

But it rests on a balance that's currently fiction. Fix truth first.

---

# PART A — Making the points number true

## A.1 What we know, from the live data

There is no consumer API for reward balances. Amex, Chase, Capital One, Bilt and Southwest
publish nothing you can authenticate against as a cardholder, and Plaid's `/liabilities/get`
carries APRs and loan balances — not points. Anything claiming otherwise is scraping.

So balances are manual snapshots, and they rot. As of today:

| Program | Snapshot | Taken | Earned since | Shown now |
|---|---|---|---|---|
| Amex MR | 208,201 | 2026-04-28 | +11,461 | 219,662 |
| Capital One Miles | 127,583 | 2026-04-28 | +7,552 | 135,135 |
| Chase UR | 109,545 | 2026-04-28 | +1,253 | 110,798 |
| SW RR | 96,616 | 2026-04-28 | +22 | 96,638 |
| Bilt | 46,670 | 2026-05-01 | 0 | 46,670 |

The roll-forward shipped today only ever **adds**. It cannot see redemptions. And the ledger proves
redemptions happened:

```
2026-01-20  QANTAS MASCOT AU                 $5.60   amex_gold
2026-01-23  ETIHAD AIRWAYS NEW YORK         $14.57   amex_gold
2026-08-06  SOUTHWES 5262187727698          $11.20   chase_southwest
```

`$5.60` is exactly the US TSA September 11th Security Fee for one one-way domestic segment. A $5.60
charge from **Qantas** is not a Qantas ticket — it's an *award* booking where the fare was paid in
points and only the tax touched the card. Same shape for the Etihad and Southwest charges.

**These are redemption fingerprints, and the points ledger has no idea they happened.** Every one
means the displayed balance is too high by however many points that ticket cost.

## A.2 The approach: award-fee fingerprinting  — **M**

Don't chase an API that doesn't exist. Mine the transaction feed that's already flowing.

An award booking leaves a distinctive trace: a **small charge from an airline or hotel merchant**,
often with no matching large fare nearby. Detection heuristic:

- merchant resolves to an airline/hotel/program brand, **and**
- amount is small in absolute terms (< ~$100) or matches known tax/fee shapes
  (`$5.60`, `$11.20`, `$5.60 × segments`, common international carrier-imposed ranges), **and**
- no fare-sized charge from the same merchant within ±3 days

On a hit, raise a **review item** — not a silent write:

> *Did you book this with points? Qantas · Jan 20 · $5.60*
> → `[ 45,000 Amex MR ]  [ Cash booking ]  [ Not travel ]`

Confirming writes a **negative `points_ledger` entry** (`source='redemption'`) so the roll-forward
becomes two-way, and records the redemption's cents-per-point:
`cpp = (cash_price_avoided − fees_paid) / points_spent × 100`.

That last number is the whole game. It turns "I have 219,662 Amex MR" into "your last four
redemptions averaged 2.4¢/pt, above your 2.0¢ baseline" — a fact no other tool can tell you,
because no other tool sees the fee charge and the balance together.

**Why this beats the alternatives:** it uses data already synced, needs no third party, no
credentials, no ToS problem, and it fixes the roll-forward's actual defect rather than papering
over it.

**Limits, stated plainly:** it won't catch a redemption with zero out-of-pocket (some domestic
awards, hotel points nights with no resort fee), and it can't know the points cost without you
saying so. It converts an invisible error into a one-tap question — it does not make the balance
automatic.

## A.3 Statement ingestion — the closest thing to a real pull  — **L**

Every issuer prints the rewards balance on the monthly statement, with a real closing date.
`docker-compose.yml` already mounts a `tax-docs` volume at `/data/tax-docs` and nothing consumes it.

- Drop statement PDFs into a watched folder (or attach via the app)
- Parse per-issuer with a small set of regexes over extracted text
- Write `points_balances` with `source='statement'` and `as_of` = statement close date
- Drift resets to zero each month, automatically

Monthly accuracy, self-hosted, no credentials shared with anyone. Combined with A.2, the balance
between statements stays honest in both directions.

## A.4 Drift as a first-class signal  — **S**

Show the operator how much they're trusting an estimate. On each program card:
`Est. · snapshot 137 days old · ±11,461 earned, 3 redemptions unconfirmed`.
Nudge to re-enter when drift exceeds a threshold (say 60 days or 20% of balance).

## A.5 Rejected, and why

| Option | Verdict |
|---|---|
| **AwardWallet API** | The only turnkey third party. Paid, and means handing them issuer credentials. Viable if A.2+A.3 prove insufficient. |
| **Issuer site scraping** | MFA breaks it constantly; against every issuer's terms. No. |
| **Email parsing** | Weaker than statements — earn/promo mail is noisy and rarely states a full balance. Fall back only. |
| **Plaid** | Does not carry reward balances. Not a matter of configuration. |

---

# PART B — The travel planner

## B.1 What HIVE knows that nothing else does

| Signal | Already in the DB |
|---|---|
| Balances per program | `points_balances` (+ roll-forward) |
| Earn rate per card per category | `earn_rules`, `points/tracker.py` |
| What a point is worth to *you* | `POINT_VALUES_CPP` |
| Redemption thresholds | `REDEMPTION_THRESHOLDS` |
| Historical travel spend | `transactions` (Travel: Flights, Hotel, Car Rental, SW Flights) |
| Cash position & runway | `position.py`, `planning.py` |
| Budget headroom this month | `budgets.py` |

Your actual travel history is already there — Avianca $1,693, Avis $711 and $125, Alaska $257×2,
a $374 rental. The planner isn't starting cold.

## B.2 Data sources — honest assessment

**Costco Travel has no public API.** It's membership-gated and its terms prohibit automated access.
I'm not going to build a scraper for it and I'd advise against one — it breaks constantly and it's
a terms violation on an account you care about.

That's less of a loss than it sounds, because **Costco Travel is cash-only** — no points, no
transfers. Its role in this product is as a *cash benchmark*, and a strong one: it's genuinely
competitive on rental cars and packages. So it gets a **manual quote lane**: paste or type a Costco
quote into a trip and it becomes a labelled cash option, ranked against everything else. Same lane
serves any portal — Chase Travel, Amex Travel, Capital One Travel, a hotel's own site — none of
which have public APIs either.

Manual entry sounds like a cop-out; it isn't. The comparison is the product, not the scraping. You
were going to open Costco Travel anyway.

| Source | Use | Reality |
|---|---|---|
| **seats.aero** Partner API | Award availability across many programs | Real, paid. The single highest-value integration for "can I get there on points." |
| **Amadeus Self-Service** | Cash flight + hotel prices | Real, free tier. The cash benchmark. |
| **Duffel / Kiwi** | Cash flights, alt | Backup if Amadeus coverage disappoints. |
| **Transfer partners & ratios** | Which currency reaches which program | Static curated table — no API exists or is needed. |
| **Costco Travel / issuer portals** | Cash benchmark | Manual quote lane. No API. |
| **Google Flights** | — | No public API (QPX retired). Don't plan on it. |

> ⚠️ Verify every one of these at build time. API terms, pricing and free-tier limits change, and
> transfer partners change several times a year. Nothing in this table should be taken as current
> without checking.

## B.3 The one insight worth building around

Your **96,638 SW RR points cannot transfer anywhere.** Southwest Rapid Rewards has no outbound
transfer partners, and its value is effectively pinned to Southwest's cash fares (revenue-based
redemption, roughly fixed cents-per-point). Meanwhile your Amex MR, Chase UR, Capital One and Bilt
balances are all *transferable* — which is exactly why they're worth 1.85–2.1¢ in `POINT_VALUES_CPP`
and SW RR is worth 1.4¢.

That means the planner's advice differs fundamentally by currency:

- **SW RR** — use it on Southwest, soon; it does nothing else and doesn't appreciate.
- **Transferables** — never transfer speculatively; transfer only against a *confirmed* award hold,
  because transfers are one-way and irreversible.

A planner that doesn't encode this will cheerfully suggest transferring Amex MR to chase an award
that's gone by the time the points land. That's the expensive mistake this product should prevent.

## B.4 Architecture

**Models** (`backend/app/models/`)

```
trip.py              Trip: name, destination, start/end, travelers, status
                           (dreaming|planning|booked|taken), cash_budget
trip_leg.py          TripLeg: trip_id, type (flight|hotel|car|activity),
                           origin, destination, date, notes
travel_option.py     TravelOption: leg_id, source (seats_aero|amadeus|manual_costco|
                           manual_portal), cash_price, points_price, program,
                           fees, cpp (computed), is_selected
transfer_path.py     TransferPath: from_program, to_program, ratio, min_transfer,
                           typical_days, bonus_pct, bonus_ends  [curated]
```

**Services** (`backend/app/travel/`)

- `valuation.py` — `cpp(cash, points, fees)`; verdict vs `POINT_VALUES_CPP` baseline
- `transfer.py` — reachable programs from current balances; shortfall; bonus-aware
- `affordability.py` — trip cost vs balances **and** cash runway (`planning.py`)
- `connector_seats.py`, `connector_amadeus.py` — external, behind config keys, both optional

**Endpoints**

```
GET/POST /api/trips                      list, create
GET      /api/trips/{id}                 trip + legs + options, ranked
POST     /api/trips/{id}/legs            add a leg
POST     /api/legs/{id}/options          add an option (manual quote lane)
GET      /api/legs/{id}/search           live award + cash search (when keys configured)
GET      /api/travel/transfer-paths      what your balances can reach
GET      /api/travel/affordability       can this trip be paid for, and how
```

**UI** — `/travel` (trip list), `/travel/[id]` (the comparison board). iOS mirrors.

**Celery** — award-availability watch on saved legs; transfer-bonus alerts; both opt-in and
rate-limit-aware.

## B.5 The comparison board — the actual product

For each leg, one ranked table. This is the screen everything else serves:

```
LAX → LIS · Mar 14                         you have: 219,662 MR · 110,798 UR · 135,135 C1

  option              cost              your cpp   verdict
  ─────────────────────────────────────────────────────────────────────────
  ✦ Aeroplan          60,000 MR + $89    2.31¢    BEST — transfer 60k MR (1:1, ~instant)
    Virgin Atlantic   55,000 UR + $240   1.94¢    fine, below your 2.05¢ UR baseline
    Cash (Amadeus)    $1,479             —        earns 4,437 MR on Gold (3x)
    Costco Travel     $1,402             —        cheapest cash · manual quote, Sep 12
  ─────────────────────────────────────────────────────────────────────────
  ⚠ Transferring is one-way. Confirm the award seat before moving points.
```

Every column comes from something HIVE already owns: balances, per-program valuations, earn rules
for the cash-booking counterfactual, transfer ratios.

## B.6 Phasing

**Phase 1 — Trips & the decision engine · zero external APIs · M/L**
Trip + leg + option models, manual entry, cpp calculator with verdict vs your baseline, transfer-path
finder, affordability against balances and runway, link trips to existing Travel transactions for
planned-vs-actual. *Ships real value with no keys, no cost, no third party.*

**Phase 2 — Points truth · M/L**
A.2 fingerprinting + review queue, A.4 drift indicator. Balance becomes two-way. **Arguably do this
first** — Phase 1's rankings are only as honest as the balance underneath them.

**Phase 3 — Cash benchmark · M**
Amadeus connector for flight/hotel cash prices. Makes cpp automatic instead of typed.

**Phase 4 — Award availability · L**
seats.aero. The "where can I actually go on 219,662 MR" screen. Paid, so gate behind a config key
and degrade gracefully when absent.

**Phase 5 — Watches & alerts · M**
Award seat watches, transfer-bonus alerts, redemption-threshold nudges wired to real trips.

**Phase 6 — Statement ingestion · L**
A.3, using the existing `tax-docs` volume.

## B.7 Risks

| Risk | Mitigation |
|---|---|
| Award APIs are paid and rate-limited | Every connector optional behind a config key; app fully usable without them |
| Transfer partners/ratios drift | Curated table with `verified_on` dates, surfaced in UI; never present stale ratios as fact |
| Fingerprinting produces false positives | Review queue, never a silent ledger write |
| Scope sprawl into a flight-search clone | The comparison board is the product. Don't rebuild Google Flights. |
| Costco/portal scraping temptation | Manual quote lane. Stays within terms and doesn't break weekly. |

---

## Recommendation

Build **Phase 2 before Phase 1.** A planner that ranks redemptions against a balance you know is
overstated — and we now have three fee charges proving it is — will give confidently wrong advice.
Fingerprinting is ~a day, and it's the difference between a planner that's accurate and one that
merely looks accurate.

Then Phase 1, which needs nothing external and turns the balance into decisions.
