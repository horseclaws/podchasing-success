# Owner Filter & Card Enrichment — Design Spec

## Goal

Add owner-based filtering to the client health results list, and surface owner name and business type on individual deal cards.

## Background

The search/poll redesign (spec: `2026-03-24-client-health-search-poll-redesign.md`) introduced a scored results list with a dashboard. Currently, deal cards show score, name, stage, amount, renewal date, and days since last contact — but not who owns the deal or what type of business it is. There is also no way to narrow results to a specific rep's book of business.

This spec adds:
1. A client-side owner filter (All / Jon / Jules / Sydney) that narrows the visible results and dashboard.
2. Owner name and business type displayed on each deal card.

---

## Data Layer

### RawDealResult — new field

Add to the `RawDealResult` interface in `lib/deal-scoring.ts`:

```ts
ownerId: string | null;   // hubspot_owner_id — raw HubSpot owner ID
```

`DealResult extends RawDealResult`, so it inherits this field automatically.

### lib/hubspot.ts — SEARCH_PROPS and mapDealToRaw

Add `'hubspot_owner_id'` to `SEARCH_PROPS`.

In `mapDealToRaw()`, add:

```ts
ownerId: p.hubspot_owner_id ?? null,
```

The `ownerName()` helper already exists in `lib/hubspot.ts` and maps the three known owner IDs to display names:

```ts
const OWNER_NAMES: Record<string, string> = {
  '1774818015': 'Jon Dispenza',
  '184892201':  'Jules Thill',
  '157100429':  'Sydney Stern',
};
export function ownerName(ownerId: string): string {
  return OWNER_NAMES[ownerId] ?? `Owner ${ownerId}`;
}
```

No changes needed to `ownerName()` — it is used as-is by the card component.

---

## New Component: OwnerFilter

**File:** `components/client-health/OwnerFilter.tsx`

### Props

```ts
interface OwnerFilterProps {
  activeOwner: string | null;   // null = All
  onSelect: (ownerId: string | null) => void;
}
```

### Behavior

- Four pills: **All**, **Jon**, **Jules**, **Sydney**
- Clicking an inactive owner pill sets the filter to that owner's ID
- Clicking the currently active owner pill clears the filter (sets to `null` / All)
- "All" pill clears the filter when clicked
- Active pill: purple fill (`#4A027D`), white text — identical style to active `PollButtons`
- Inactive pill: light purple background (`#F3F0F8`), purple text (`#4A027D`)
- The component is **only rendered when results are present** (`results.length > 0`) — controlled by the parent

### Owner definitions (hardcoded in component)

```ts
const OWNERS = [
  { id: '1774818015', label: 'Jon' },
  { id: '184892201',  label: 'Jules' },
  { id: '157100429',  label: 'Sydney' },
];
```

---

## Updated Component: DealResultCard

**File:** `components/client-health/DealResultCard.tsx`

Add two new lines to the right-side metadata column, below the existing renewal and contact fields:

- **Owner name** — `ownerName(deal.ownerId)` from `@/lib/hubspot`, shown only when `deal.ownerId` is non-null
- **Business type** — `deal.businessType`, shown only when non-null

Both use the same `text-xs` style and `#9ca3af` color as the existing metadata lines.

Import: `import { ownerName } from '@/lib/hubspot';`

---

## Page State (app/client-health/page.tsx)

Add one new state variable:

```ts
const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
```

Add a computed filtered list (not stored in state — derived inline):

```ts
const filteredResults = ownerFilter
  ? results.filter(d => d.ownerId === ownerFilter)
  : results;
```

### Filter persistence

- The filter **persists across new poll and search results** — it stays active until the user explicitly clicks the active owner pill to clear it.
- No automatic reset when a new poll or search fires.

### Component wiring

| Component | Receives |
|---|---|
| `OwnerFilter` | `activeOwner={ownerFilter}`, `onSelect={setOwnerFilter}` — rendered only when `results.length > 0 && showList` |
| `ResultsDashboard` | `deals={filteredResults}` (reflects filtered set) |
| `DealResultsList` | `deals={filteredResults}` |

### Placement

`OwnerFilter` sits between `PollButtons` and the dashboard/results area, rendered only when there are results to filter.

---

## UI Layout (updated)

```
[ Search: company or deal name... ]         [ Search ]
[ Renewing in 30 days ] [ Renewing in 60 days ] [ Last Contacted 45+ days ]

[ All ] [ Jon ] [ Jules ] [ Sydney ]          ← shown only when results present

┌─────────────────────────────────────────────────────┐
│ Total Value: $347,500  │ By Type: ...  │ By Stage: ...│  ← reflects filter
├─────────────────────────────────────────────────────┤
│ [247] Spotify · $120,000 · Renews Apr 2 · 62d ago   │
│                            Jon Dispenza              │
│                            Podcast Network           │
│ [189] NPR    · $95,000  · Renews Apr 15 · 48d ago   │
│                            Jules Thill               │
│                            Brand                     │
└─────────────────────────────────────────────────────┘
```

---

## Error Handling / Edge Cases

- `ownerId: null` — owner pill not shown on card; deal still appears in "All" and in any poll result
- `businessType: null` — business type line not shown on card
- Owner filter active, zero matching deals — show "No deals match this criterion." (reuse existing empty state message)
- Filter persists when switching between poll types — user sees filtered view of the new results immediately

---

## Out of Scope

- Multi-owner selection (AND/OR combinations)
- Filtering by owner at the API/HubSpot level (server-side query filter)
- Adding new owners without a code change (owner list is hardcoded to the three known reps)
