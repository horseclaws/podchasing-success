# Client Health Search/Poll Redesign — Design Spec

## Goal

Replace the auto-selecting client search with a list-based results view, add three deal-poll shortcuts, and surface a dashboard of aggregate metrics above every result set.

## Background

The existing `/client-health` page auto-selects a deal when search returns a single result, making it impossible to browse. Users also need quick access to time-sensitive cohorts (upcoming renewals, lapsed contacts) without typing. The new design unifies search and poll results into one scored, sorted list with aggregate context.

---

## UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  [Search: company or deal name...]                       │
│  [Renewing in 30 days] [Renewing in 60 days] [Contacted 45+d] │
├──────────────────────────────────────────────────────────┤
│  Dashboard  (shown whenever results are present)         │
│  Total Value: $347,500  │  By Type: podcast 8, brand 3  │
│                         │  By Stage: closed won 6, ...  │
├──────────────────────────────────────────────────────────┤
│  [Score: 247] Spotify  ·  $120,000  ·  Renews Apr 2  ·  62d no contact │
│  [Score: 189] NPR      ·  $95,000   ·  Renews Apr 15  · 48d no contact │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

Clicking any result opens the full `HealthReportView` for that deal, identical to the current behavior.

---

## Poll Buttons

Three buttons sit below the search bar. Clicking one fetches deals matching the criterion and populates the results list (clears any existing search results).

| Button label | HubSpot filter |
|---|---|
| Renewing in 30 days | `contract_end_date` between today and today + 30 days |
| Renewing in 60 days | `contract_end_date` between today and today + 60 days |
| Last Contacted 45+ days | `notes_last_contacted` older than today − 45 days |

Active poll button is highlighted so the user knows which cohort they are viewing.

---

## Priority Scoring

Each deal in a result set receives a score from 0–300. All three components are **normalized within the result set** (highest value in set = 100 pts), so scores reflect relative priority, not absolute thresholds.

| Component | Field | Direction | Max pts |
|---|---|---|---|
| Deal value | `amount` | Higher = more pts | 100 |
| Days since last contact | `notes_last_contacted` | More days = more pts | 100 |
| Renewal urgency | `contract_end_date` | Fewer days remaining = more pts (past-due = 100) | 100 |

**Formula:**

```
valueScore      = (amount / maxAmount) * 100
contactScore    = (daysSinceContact / maxDaysSinceContact) * 100
renewalScore    = ((maxDaysUntilRenewal - daysUntilRenewal) / maxDaysUntilRenewal) * 100
                  clamped to [0, 100]; deals past end date = 100

totalScore = round(valueScore + contactScore + renewalScore)
```

Deals with missing fields default that component to 0. Results sorted descending by `totalScore`.

---

## Dashboard

Shown above the results list whenever results are present. Three tiles:

1. **Total Contract Value** — sum of `amount` across all results, formatted as `$347,500` (full integer with commas, no abbreviation).
2. **By Business Type** — list of `business_type` values with counts, e.g. `Podcast Network: 6 · Brand: 3 · Agency: 2`.
3. **By Deal Stage** — list of `dealstage` values with counts.

Both distribution tiles show a simple color-bar per category. No pie charts — scannable text with proportional bars.

---

## API

### Existing: `POST /api/hubspot/search`

Currently returns a single deal. Change to return an **array** of up to 20 deals, each with scoring fields:

```ts
{
  id: string;
  name: string;
  stage: string;
  pipeline: string;
  amount: number | null;
  contractEndDate: string | null;       // ISO date
  lastContactedDate: string | null;     // ISO date
  businessType: string | null;
  company: { id: string | null; name: string; domain: string | null };
}
```

### New: `POST /api/hubspot/poll`

```ts
// Request
{ type: 'renew_30' | 'renew_60' | 'contacted_45' }

// Response — same deal shape as search, plus computed score fields
{
  deals: DealResult[];   // sorted by totalScore descending
  dashboard: {
    totalValue: number;
    byBusinessType: Record<string, number>;
    byDealStage: Record<string, number>;
  };
}
```

Uses HubSpot Deals Search API (`POST /crm/v3/objects/deals/search`) with `filterGroups`:

- `renew_30` / `renew_60`: `contract_end_date` `BETWEEN` today and today+N (timestamp ms range)
- `contacted_45`: `notes_last_contacted` `LT` today−45 days (timestamp ms)

Fetch up to 100 deals per poll (HubSpot page size limit), score and sort, return top 50.

---

## Component Architecture

```
app/client-health/page.tsx          ← orchestrates state: results, activeMode, selectedDeal
  ClientSearchBar                   ← modified: never auto-selects, calls onResults(deals[])
  PollButtons                       ← new: 3 buttons, highlights active, calls onResults(deals[])
  ResultsDashboard                  ← new: receives deals[], computes/displays dashboard tiles
  DealResultsList                   ← new: receives deals[], renders sorted cards
    DealResultCard × N              ← new: score badge, deal name, company, value, stage, dates
  HealthReportView                  ← existing: shown when selectedDeal is set
```

### Files

| Action | Path |
|---|---|
| Create | `components/client-health/PollButtons.tsx` |
| Create | `components/client-health/ResultsDashboard.tsx` |
| Create | `components/client-health/DealResultsList.tsx` |
| Create | `components/client-health/DealResultCard.tsx` |
| Create | `app/api/hubspot/poll/route.ts` |
| Modify | `app/client-health/page.tsx` |
| Modify | `components/client-health/ClientSearchBar.tsx` |
| Modify | `app/api/hubspot/search/route.ts` |
| Possibly modify | `lib/hubspot.ts` (add `searchDeals` and `pollDeals` helpers) |

---

## State Management

All state lives in `page.tsx` (no external store):

```ts
type Mode = 'idle' | 'search' | 'poll_renew_30' | 'poll_renew_60' | 'poll_contacted_45';

const [mode, setMode] = useState<Mode>('idle');
const [results, setResults] = useState<DealResult[]>([]);
const [loading, setLoading] = useState(false);
const [selectedDeal, setSelectedDeal] = useState<DealResult | null>(null);
```

When a result is selected, `HealthReportView` renders in place of the list. A back button (or the existing close/save flow) returns to the list.

---

## Scoring Computation

Scoring runs **client-side** after results are returned — the API returns raw deal data, the client normalizes and sorts. This keeps the API simple and allows re-scoring without a round-trip.

The poll endpoint pre-sorts by score server-side as a fallback for large sets (>50 deals), but the client always re-scores its slice.

---

## Error Handling

- Search with no results: show "No deals found" state in list area; dashboard hidden.
- Poll returning 0 results: show "No deals match this criterion" state.
- API error: show inline error message; do not clear previous results.
- Missing fields (`amount`, `contract_end_date`, `notes_last_contacted`): score that component as 0, display `—` in the card.

---

## Out of Scope

- Pagination beyond 50 results
- Saving/exporting result sets
- Multi-select or bulk actions
- Mixpanel data in the results list (health tier shown in HealthReportView only, as today)
