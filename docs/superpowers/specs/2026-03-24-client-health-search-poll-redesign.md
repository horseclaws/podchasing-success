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

```typescript
// Safe normalization — returns 0 when max is 0 (avoids divide-by-zero)
function norm(value: number, max: number): number {
  return max > 0 ? (value / max) * 100 : 0;
}

// Days until contract end — negative means past due; null contractEndDate → undefined
function daysUntilRenewal(deal: RawDealResult): number | null {
  if (!deal.contractEndDate) return null;
  return Math.round((new Date(deal.contractEndDate).getTime() - Date.now()) / 86400000);
}

function scoreDealSet(deals: RawDealResult[]): DealResult[] {
  const amounts       = deals.map(d => d.amount ?? 0);
  const contactDays   = deals.map(d => d.lastContactedDate
    ? Math.round((Date.now() - new Date(d.lastContactedDate).getTime()) / 86400000)
    : 0);
  const renewalDays   = deals.map(d => daysUntilRenewal(d));   // null if no date

  const maxAmount     = Math.max(...amounts);
  const maxContact    = Math.max(...contactDays);

  // For renewal: use only deals with a contractEndDate to find the max future days.
  // If ALL deals with dates are past due (all renewalDays ≤ 0), max ≤ 0 → all get 100.
  const validRenewal  = renewalDays.filter((d): d is number => d !== null);
  const maxRenewal    = validRenewal.length > 0 ? Math.max(...validRenewal) : null;

  return deals.map((deal, i) => {
    const scoreValue   = norm(amounts[i],     maxAmount);
    const scoreContact = norm(contactDays[i], maxContact);

    let scoreRenewal: number;
    if (renewalDays[i] === null) {
      scoreRenewal = 0;                                    // no date → 0 pts
    } else if (maxRenewal === null || maxRenewal <= 0) {
      scoreRenewal = 100;                                  // all past due → all max urgency
    } else {
      scoreRenewal = Math.min(100, Math.max(0,
        norm(maxRenewal - renewalDays[i], maxRenewal)));
    }

    return {
      ...deal,
      scoreValue:   Math.round(scoreValue),
      scoreContact: Math.round(scoreContact),
      scoreRenewal: Math.round(scoreRenewal),
      totalScore:   Math.round(scoreValue + scoreContact + scoreRenewal),
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}
```

Edge cases (all handled by code above):
- Null `amount` / `lastContactedDate` / `contractEndDate` → that component scores 0; card displays `—`.
- All deals have the same non-null value → max equals every value → all score 100 for that component (ties; other components differentiate).
- All deals past their contract end date → `maxRenewal ≤ 0` → all get `scoreRenewal = 100`.
- Single-result set → all components normalize to 100 → `totalScore = 300`.

**Render cap:** `DealResultsList` renders the top 50 deals (after scoring sort). For search (≤20) this is all results; for poll (≤100) this caps the list at 50.

Results sorted descending by `totalScore`.

---

## Dashboard

Shown above the results list whenever results are present. Three tiles:

1. **Total Contract Value** — sum of `amount` across all results, formatted as `$347,500` (full integer with commas, no abbreviation).
2. **By Business Type** — list of `business_type` values with counts, e.g. `Podcast Network: 6 · Brand: 3 · Agency: 2`.
3. **By Deal Stage** — list of `dealstage` values with counts.

Both distribution tiles show a simple color-bar per category. Bars are proportional relative to the largest category (largest = full width). Cycle through brand colors `#4A027D → #0DAAC9 → #2BDA9F → #FB0467` for each category row. No minimum bar width — very small categories may appear as a thin sliver. No pie charts.

---

## API

### Shared type: `DealResult`

Both endpoints return arrays of this type. Scoring fields are added client-side after the API responds.

```ts
interface DealResult {
  id: string;
  name: string;
  stage: string;
  pipeline: string;
  amount: number | null;
  contractEndDate: string | null;       // ISO date string
  lastContactedDate: string | null;     // ISO date string (notes_last_contacted)
  businessType: string | null;
  company: { id: string | null; name: string; domain: string | null };
  // Added client-side after normalization:
  scoreValue: number;        // 0–100
  scoreContact: number;      // 0–100
  scoreRenewal: number;      // 0–100
  totalScore: number;        // 0–300
}
```

### Existing: `POST /api/hubspot/search`

Currently this endpoint searches companies (via `searchCompanies` in `lib/hubspot.ts`) and returns `{ id, name, domain, dealId }[]`. It is only called from `ClientSearchBar` — no other consumers.

**Change:** Replace company search with deal search. Return an array of up to 20 raw `DealResult` objects (score fields are added client-side):

```ts
{ deals: Omit<DealResult, 'scoreValue' | 'scoreContact' | 'scoreRenewal' | 'totalScore'>[] }
```

The `DealResult.id` field is the deal ID — used by the page to call `/api/hubspot/client` when a deal is selected (same pattern as today's `company.dealId`).

### New: `POST /api/hubspot/poll`

```ts
// Request
{ type: 'renew_30' | 'renew_60' | 'contacted_45' }

// Response — same raw deal shape as search (scores computed client-side)
{
  deals: Omit<DealResult, 'scoreValue' | 'scoreContact' | 'scoreRenewal' | 'totalScore'>[];
}
```

Uses HubSpot Deals Search API (`POST /crm/v3/objects/deals/search`) with `filterGroups`:

- `renew_30` / `renew_60`: `contract_end_date` `BETWEEN` today and today+N (timestamp ms range)
- `contacted_45`: `notes_last_contacted` `LT` today−45 days (timestamp ms)

Fetch up to 100 deals (HubSpot page size limit) and return all of them. Scoring and sorting happen entirely client-side so no server-side pre-sort is needed — the client scores the full set and renders the top results.

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

When a result is selected, the page calls `/api/hubspot/client` with `dealId: selectedDeal.id` (same pattern as today), then renders `HealthReportView` in place of the list (results and dashboard are hidden).

`HealthReportView` already accepts an `onReset: () => void` prop — this is the back/close mechanism. No new prop is needed. The page passes `onReset={() => setSelectedDeal(null)}`. When triggered (back button or the existing save/close flow), `selectedDeal` is set to null and the results list is restored exactly as it was — `mode`, `results`, active poll highlight, and search query text are all preserved (none are cleared on reset).

**Search trigger:** `ClientSearchBar` fires on form submit (Enter key or button click). This is unchanged from today. The poll highlight (`mode`) clears when search results are returned — not on keystroke.

---

## Scoring Computation

Scoring runs **client-side** after results are returned — both endpoints return raw deal data, the client normalizes across the full result set and sorts. Both search (up to 20 deals) and poll (up to 100 deals) use identical scoring logic; the only difference is the input size.

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
