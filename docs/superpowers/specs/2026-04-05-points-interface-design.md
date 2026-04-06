# Points Interface Design
**Date:** 2026-04-05
**Status:** Approved

## Summary

Rebuild the `/points` page from a static server component into a rich, interactive client component. Two sections on a single vertical scroll: program portfolio cards at the top, earn activity ledger at the bottom. A time window picker controls both sections. Inline manual balance editing. Full-text search and multi-select filters over the ledger.

The optimizer is excluded from this iteration.

---

## Architecture

### Backend (3 changes)

**1. Fix `GET /api/points/summary`**
- Add `days: int = Query(90, ge=7, le=365)` param
- Join `PointsLedger → Transaction` on `transaction_id`, filter `Transaction.date >= today - days`
- The existing `points_earned_90d` field was broken (no date filter applied); this fixes it
- Field name stays `points_earned_90d` in the response shape for backward compat but now reflects the actual window

**2. Extend `GET /api/points/ledger`**
- Add `days: int = Query(90, ge=7, le=365)` param (alternative to existing `month` param; if `days` is provided, `month` is ignored)
- Join to `Transaction` to fetch `merchant: str | None` and `amount: float` — add both to `LedgerEntryOut`
- Keep existing `account_id` filter

**3. Add `PUT /api/points/balance`**
- Body: `{ program: str, balance: int }`
- Upsert into `PointsBalance` (update if exists, insert otherwise)
- Response: `{ program: str, balance: int, updated_at: str }`

### Frontend (full rebuild of `/points/page.tsx`)

Convert from async server component to `"use client"` component. Add two new API client methods to `api.ts`:
- `api.points.ledger(params: { days?: number; account_id?: string })` → `LedgerEntry[]`
- `api.points.setBalance(program: string, balance: number)` → `{ program, balance, updated_at }`

---

## Page Layout

### Header
- Title: "Points"
- Subtext: estimated total portfolio value (updates with time window)
- Time window selector (right side): pill buttons — `30d | 90d | 180d | 1y` (default 90d)
- Changing the window re-fetches summary and ledger in parallel

### Program Cards Grid (3-col, existing structure enhanced)
Each card:
- Program name + redemption nudge badge (existing)
- Estimated value badge (accent color, existing)
- Stats: Balance (manual, editable inline), Earned (window), Threshold (existing)
- **Inline balance input**: clicking the balance value makes it editable. On blur or Enter, calls `PUT /api/points/balance`. Optimistic update — reverts on error. If no balance set, shows dim "Add balance" prompt.
- Progress bar toward redemption threshold (existing, uses manual balance if set)

### Earn Activity Section
- Section heading: "Earn Activity" + result count (e.g. "143 transactions")
- Search bar: filters by merchant name (client-side, no API calls on keystroke)
- Filter pills: Program (multi-select) + Card (multi-select) — both clearable
- Table columns: Date · Merchant · Category · Card · Rate · Points · Est. Value
- Sorted by date desc, capped at the time window
- Empty state when no rows match search/filters

---

## Data Flow & State

```
component mounts
  → fetch summary(days) + ledger(days) in parallel
  → program cards render when summary resolves
  → activity feed renders when ledger resolves (independently)

time window changes
  → re-fetch both in parallel

balance edit (blur/enter)
  → optimistic update to local summary state
  → PUT /api/points/balance
  → on error: revert

search/filter
  → pure client-side filter over fetched ledger array
  → no API calls on keystroke
```

**Loading states:** skeleton cards while summary loads; skeleton rows while ledger loads. Each section fails independently — a broken ledger doesn't break the program cards.

---

## Error Handling

- Summary fetch failure: full-page inline error (can't show anything meaningful without it)
- Ledger fetch failure: activity section shows inline error, program cards still visible
- Balance save failure: revert optimistic update, show brief error toast on the card

---

## Out of Scope

- Card optimizer (deferred)
- Points history chart over time
- Pagination on the ledger (window cap is sufficient)
- Notifications/email when threshold is crossed
