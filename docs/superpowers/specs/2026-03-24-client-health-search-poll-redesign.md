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

**Renewal scoring behavior (stated explicitly):**
- Mixed set (some past due, some future): past-due deals get `scoreRenewal = 100`; future deals get `norm(maxRenewal - daysUntilRenewal[i], maxRenewal)` where the deal with `daysUntilRenewal = maxRenewal` (furthest out) scores 0 and the deal renewing soonest scores highest. This is correct and intentional.
- All past-due set: `maxRenewal ≤ 0` → all get `scoreRenewal = 100`. Differentiation comes from value and contact components.
- All same future date: all `daysUntilRenewal[i] = maxRenewal` → all score 0 for renewal. Differentiation comes from other components. This is intentional — equal renewal urgency contributes equally (0 differential).

Edge cases:
- Null `amount` / `lastContactedDate` / `contractEndDate` → that component scores 0; card displays `—`.
- All deals past their contract end date → all get `scoreRenewal = 100`.
- Single-result set → all three components are at their respective maxima → `totalScore = 300`.

**Render cap:** `DealResultsList` renders the top 50 deals (after scoring sort). For search (≤20) this is all results; for poll (≤100) this caps the list at 50.

Results sorted descending by `totalScore`.

---

## Dashboard

Shown above the results list whenever results are present. Three tiles:

1. **Total Contract Value** — sum of `amount` across all results, formatted as `$347,500` (full integer with commas, no abbreviation).
2. **By Business Type** — list of `business_type` values with counts, e.g. `Podcast Network: 6 · Brand: 3 · Agency: 2`.
3. **By Deal Stage** — list of deal stage **labels** (human-readable, via `stageLabel()`) with counts. Aggregation happens after label mapping.

Both distribution tiles show a simple color-bar per category. Bars are proportional relative to the largest category (largest = full width). Cycle through brand colors `#4A027D → #0DAAC9 → #2BDA9F → #FB0467` for each category row; for 5+ categories, wrap back to `#4A027D`. No minimum bar width — very small categories may appear as a thin sliver. No pie charts.

Null or empty-string values for `businessType` or `stage` are grouped under the label `"Unknown"` and included in the distribution counts.

---

## API

### HubSpot property notes

The following deal properties must be added to `DEAL_PROPS` in `lib/hubspot.ts` (they are not currently fetched):
- `notes_last_contacted` — standard HubSpot property, last date a note/activity was logged
- `business_type` — custom deal property already assigned to all deals
- `amount` — standard HubSpot property (deal value)

Also add these to the properties list in `searchCompanies` (now `searchDeals`) and in the new poll query.

**Stage ID → label mapping** (already defined as comments in `lib/hubspot.ts`, extract into a helper):

```ts
const STAGE_LABELS: Record<string, string> = {
  '10311744':   'Onboarding',
  '1236558246': 'Money Back Window',
  '191321462':  'Basic Pro',
  '10311745':   'Engagement',
  '10311748':   'At Risk',
  '11544543':   'Monthly Renewal',
  '10311746':   'Promised Renewal',
  '12714085':   'Connect/API Deals',
  '8879384':    'Paused/Feature Release',
};
export function stageLabel(stageId: string): string {
  return STAGE_LABELS[stageId] ?? stageId;
}
```

Use `stageLabel()` in the API responses and dashboard.

### Company data in list results

Fetching company associations for every deal in a poll (up to 100 deals) would require 100 individual API calls. This is too expensive. **Do not fetch company data for list results.** The `DealResultCard` displays the deal name as the primary identifier. The `company` field in `RawDealResult` is populated only when association data is already available (e.g., from the deals search response `associations` field if HubSpot returns it inline); otherwise it defaults to `{ id: null, name: '', domain: null }`. Full company data is loaded by `/api/hubspot/client` when the user clicks a result.

### Shared types

```ts
// Raw shape returned by both API endpoints
interface RawDealResult {
  id: string;                           // HubSpot deal ID
  name: string;                         // dealname — used as primary display in list cards
  stage: string;                        // stageLabel(dealstage) — human-readable
  pipeline: string;
  amount: number | null;                // amount (deal value)
  contractEndDate: string | null;       // contract_end_date — ISO date string
  lastContactedDate: string | null;     // notes_last_contacted — ISO date string
  businessType: string | null;          // business_type
  company: { id: string | null; name: string; domain: string | null };  // empty for list results; see above
}

// After client-side scoring is applied
interface DealResult extends RawDealResult {
  scoreValue: number;        // 0–100
  scoreContact: number;      // 0–100
  scoreRenewal: number;      // 0–100
  totalScore: number;        // 0–300
}
```

`selectedDeal` in page state is of type `DealResult` (already scored, drawn from the `results` array).

### Existing: `POST /api/hubspot/search`

Currently this endpoint searches companies (via `searchCompanies` in `lib/hubspot.ts`) and returns `{ id, name, domain, dealId }[]`. It is only called from `ClientSearchBar` — no other consumers.

**Change:** Replace company search with deal search. Return an array of up to 20 `RawDealResult` objects:

```ts
{ deals: RawDealResult[] }
```

The `RawDealResult.id` field is the deal ID — used by the page to call `/api/hubspot/client` when a deal is selected (same pattern as today's `company.dealId`).

**Before changing the response shape:** grep the codebase for `/api/hubspot/search` to confirm no other callers exist. If other callers are found, create a new endpoint `/api/hubspot/search-deals` and leave the original unchanged. The only known caller is `ClientSearchBar.tsx` — update it to use the new `{ deals: RawDealResult[] }` shape instead of the old flat array.

### New: `POST /api/hubspot/poll`

```ts
// Request
{ type: 'renew_30' | 'renew_60' | 'contacted_45' }

// Response — same raw deal shape as search (scores computed client-side)
{
  deals: RawDealResult[];
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

### Component props

```ts
// ClientSearchBar — modified
interface ClientSearchBarProps {
  onResults: (deals: RawDealResult[]) => void;  // called with [] on empty results
  disabled?: boolean;                           // true while loading
}

// PollButtons — new
interface PollButtonsProps {
  activeMode: Mode;
  disabled: boolean;
  onPoll: (type: 'renew_30' | 'renew_60' | 'contacted_45') => void;
}

// ResultsDashboard — new
interface ResultsDashboardProps {
  deals: DealResult[];  // scored, full result set (not capped)
}

// DealResultsList — new
interface DealResultsListProps {
  deals: DealResult[];  // scored; component slices to top 50 internally
  onSelect: (deal: DealResult) => void;
}

// DealResultCard — new
interface DealResultCardProps {
  deal: DealResult;
  onSelect: () => void;
}
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

`HealthReportView` already accepts an `onReset: () => void` prop (confirmed in source at `components/client-health/HealthReportView.tsx` line 10) — no new prop is needed. The page passes `onReset={() => setSelectedDeal(null)}`. When triggered (back button or the existing save/close flow), `selectedDeal` is set to null and the results list is restored exactly as it was — `mode`, `results`, active poll highlight, and search query text are all preserved (none are cleared on reset).

**Search query state:** `ClientSearchBar` manages its own `query` state internally (existing behavior). The parent does not need to lift or control this value. Text is preserved naturally across poll clicks since the search component is never remounted.

**Search trigger:** `ClientSearchBar` fires on form submit (Enter key or button click). This is unchanged from today. When a poll button is clicked, the search query text in the input is **preserved** (not cleared) — only the results and active mode change. When a search is submitted, the active poll highlight clears (mode becomes `'search'`).

**Poll button active state:** When a poll button is clicked, highlight it **immediately** (before results arrive, before loading completes). The highlighted button also becomes visually inactive (un-highlighted) when a search is submitted. Each poll button conditionally renders its highlighted style based on `mode === 'poll_renew_30'` etc.

**Loading state UI:** While `loading` is true, the UI transitions **immediately** (no delay):
- Show a spinner/loading indicator in the list area (reuse the existing `LoadingSpinner` component).
- Hide the dashboard immediately (not after results arrive).
- Disable the poll buttons and the search submit button so the user cannot trigger a second fetch.

**Re-fetching:** No caching. If the user clicks a poll button they already clicked, the page re-fetches. Results state is always replaced by the most recent fetch.

**Render cap:** `DealResultsList` slices the scored+sorted array to 50 items client-side before rendering. No "showing N of X" indicator — this is an internal cap, not a pagination feature.

**Null amount in dashboard:** Deals with `amount = null` contribute `$0` to the total contract value. No warning is shown.

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
